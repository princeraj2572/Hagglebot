import { createLLMFromEnv } from "../lib/llm";
import type { LLM } from "../lib/llm/types";
import { createOrdersController, createPaymentsController } from "../lib/paypal/client";
import { loadPayPalConfig } from "../lib/paypal/config";
import { PERSONAS, scaledPersona } from "../lib/sellers/personas";
import { listCategories, mergeSources, searchListings, type Category, type Page, type SearchOptions } from "../lib/channel3/search";
import { searchEbay } from "../lib/ebay/search";
import { searchEtsy } from "../lib/etsy/search";
import { LISTING_PREFIX, personaFromEndpoint } from "../lib/sellers/listing";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { HUMAN_PERSONA, HumanSeller } from "../lib/sellers/humanSeller";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";

export interface Services {
  repo: Repo;
  runner: NegotiationRunner;
  payments: PaymentService;
  /** Real listings from Channel3, eBay and Etsy (whichever have keys); null until at least one is set. */
  findListings: ((query: string, opts?: Omit<SearchOptions, "limit" | "fetchImpl">) => Promise<Page>) | null;
  /** The marketplace's top-level categories; cached because they rarely change. */
  categories: (() => Promise<Category[]>) | null;
  /** Safe to expose to the browser: the sandbox client id is public by design. */
  publicConfig: {
    listings: boolean;
    /** PayPal sandbox client id for the checkout; null when no credentials are set (payments are then mocked). */
    paypalClientId: string | null;
    /** Sandbox buyer account, shown as a hint for which account to log in with. */
    paypalBuyerEmail: string | null;
    /** "llm" when a language model phrases the messages, "template" when no model key is set. */
    llmMode: "llm" | "template";
  };
}

export function buildServices(env: Record<string, string | undefined> = process.env): Services {
  const repo = new Repo(openDb(env.HAGGLEBOT_DB ?? "data/hagglebot.db"));

  // The language model only phrases each move; the code decides every price. With no key, templates are used.
  const haveLlm = Boolean(env.GEMINI_API_KEY?.trim() || env.GROQ_API_KEY?.trim());
  const llm: LLM | null = haveLlm ? createLLMFromEnv(env) : null;

  let paypal: ReturnType<typeof loadPayPalConfig> | null = null;
  try {
    paypal = loadPayPalConfig(env);
  } catch {
    paypal = null; // no sandbox credentials: payments are mocked
  }

  const delay = Number(env.HAGGLEBOT_STEP_DELAY_MS ?? 700);
  const runner = new NegotiationRunner({
    repo,
    llm,
    stepDelayMs: Number.isFinite(delay) && delay >= 0 ? Math.min(delay, 30_000) : 700,
    log: (m, e) => console.error(m, e),
    sellerFor: (contact, initialAsk, budget) => {
      if (contact.persona === HUMAN_PERSONA) return new HumanSeller(contact.id, contact.name, `${contact.wantId}:${contact.id}`);
      if (contact.endpoint.startsWith(LISTING_PREFIX)) return new PersonaSeller(personaFromEndpoint(contact.endpoint), llm, initialAsk);
      const persona = PERSONAS.find((p) => p.id === contact.persona);
      if (!persona) throw new Error(`Unknown seller persona "${contact.persona}"`);
      return new PersonaSeller(budget ? scaledPersona(persona, budget) : persona, llm, initialAsk);
    },
  });
  runner.recoverInterrupted();

  const payments = new PaymentService({
    repo,
    runner,
    orders: paypal ? createOrdersController(paypal) : null,
    paymentsApi: paypal ? createPaymentsController(paypal) : null,
    sellerEmail: paypal?.sellerEmail,
  });

  const c3 = env.CHANNEL3_API_KEY?.trim();
  const ebayId = env.EBAY_CLIENT_ID?.trim();
  const ebaySecret = env.EBAY_CLIENT_SECRET?.trim();
  const etsy = env.ETSY_API_KEY?.trim();
  type Opts = Omit<SearchOptions, "limit" | "fetchImpl" | "pageToken">;
  const sources: Record<string, (q: string, opts: Opts, pageToken: string | undefined) => Promise<Page>> = {};
  if (c3) sources.channel3 = (q, o, pageToken) => searchListings(q, c3, { ...o, pageToken, limit: 24 });
  if (ebayId && ebaySecret) sources.ebay = (q, o, pageToken) => searchEbay(q, ebayId, ebaySecret, { ...o, pageToken, limit: 12 });
  if (etsy) sources.etsy = (q, o, pageToken) => searchEtsy(q, etsy, { ...o, pageToken, limit: 12 });
  const findListings =
    Object.keys(sources).length > 0
      ? (q: string, { pageToken, ...o }: Omit<SearchOptions, "limit" | "fetchImpl"> = {}) =>
          mergeSources(Object.fromEntries(Object.entries(sources).map(([n, s]) => [n, (t: string | undefined) => s(q, o, t)])), pageToken)
      : null;
  let cached: { at: number; list: Category[] } | null = null;
  const categories = findListings
    ? async () => {
        if (!c3) return []; // categories come from Channel3; eBay and Etsy are searched by text only
        if (!cached || Date.now() - cached.at > 3_600_000) cached = { at: Date.now(), list: await listCategories(c3) };
        return cached.list;
      }
    : null;

  return { repo, runner, payments, findListings, categories, publicConfig: {
      listings: findListings !== null,
      paypalClientId: paypal?.clientId ?? null,
      paypalBuyerEmail: paypal?.buyerEmail ?? null,
      llmMode: haveLlm ? "llm" : "template",
    },
  };
}

const g = globalThis as unknown as { __hagglebot?: Services };

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function getServices(): Services {
  g.__hagglebot ??= buildServices();
  return g.__hagglebot;
}

/** Test hook: swap the process-wide services (e.g. for an in-memory database). */
export function setServicesForTest(s: Services | undefined): void {
  g.__hagglebot = s;
}
