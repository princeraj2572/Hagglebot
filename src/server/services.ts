import { PERSONAS, scaledPersona } from "../lib/sellers/personas";
import { listCategories, searchListings, type Category, type Page, type SearchOptions } from "../lib/channel3/search";
import { LISTING_PREFIX, personaFromEndpoint } from "../lib/sellers/listing";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";

export interface Services {
  repo: Repo;
  runner: NegotiationRunner;
  payments: PaymentService;
  /** Real retailer listings from Channel3; null until CHANNEL3_API_KEY is set. */
  findListings: ((query: string, opts?: Omit<SearchOptions, "limit" | "fetchImpl">) => Promise<Page>) | null;
  /** The marketplace's top-level categories; cached because they rarely change. */
  categories: (() => Promise<Category[]>) | null;
  /** Safe to expose to the browser. */
  publicConfig: { listings: boolean };
}

export function buildServices(env: Record<string, string | undefined> = process.env): Services {
  const repo = new Repo(openDb(env.HAGGLEBOT_DB ?? "data/hagglebot.db"));

  const delay = Number(env.HAGGLEBOT_STEP_DELAY_MS ?? 700);
  const runner = new NegotiationRunner({
    repo,
    llm: null, // mock negotiation: the template negotiator writes every message
    stepDelayMs: Number.isFinite(delay) && delay >= 0 ? Math.min(delay, 30_000) : 700,
    log: (m, e) => console.error(m, e),
    sellerFor: (contact, initialAsk, budget) => {
      if (contact.endpoint.startsWith(LISTING_PREFIX)) return new PersonaSeller(personaFromEndpoint(contact.endpoint), null, initialAsk);
      const persona = PERSONAS.find((p) => p.id === contact.persona);
      if (!persona) throw new Error(`Unknown seller persona "${contact.persona}"`);
      return new PersonaSeller(budget ? scaledPersona(persona, budget) : persona, null, initialAsk);
    },
  });
  runner.recoverInterrupted();

  const payments = new PaymentService({ repo, runner });

  const c3 = env.CHANNEL3_API_KEY?.trim();
  const findListings = c3 ? (q: string, opts: Omit<SearchOptions, "limit" | "fetchImpl"> = {}) => searchListings(q, c3, { ...opts, limit: 24 }) : null;
  let cached: { at: number; list: Category[] } | null = null;
  const categories = c3
    ? async () => {
        if (!cached || Date.now() - cached.at > 3_600_000) cached = { at: Date.now(), list: await listCategories(c3) };
        return cached.list;
      }
    : null;

  return { repo, runner, payments, findListings, categories, publicConfig: { listings: findListings !== null } };
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
