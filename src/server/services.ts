import { createLLMFromEnv } from "../lib/llm";
import type { LLM } from "../lib/llm/types";
import { PERSONAS } from "../lib/sellers/personas";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { createOrdersController } from "../lib/paypal/client";
import { loadPayPalConfig } from "../lib/paypal/config";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";

export interface Services {
  repo: Repo;
  runner: NegotiationRunner;
  payments: PaymentService;
  /** Safe to expose to the browser: the sandbox client id is public by design. */
  publicConfig: { paypalClientId: string | null; paypalBuyerEmail: string | null; llmMode: "llm" | "template" };
}

export function buildServices(env: Record<string, string | undefined> = process.env): Services {
  const repo = new Repo(openDb(env.HAGGLEBOT_DB ?? "data/hagglebot.db"));
  const haveLlm = Boolean(env.GEMINI_API_KEY?.trim() || env.GROQ_API_KEY?.trim());
  const llm: LLM | null = haveLlm ? createLLMFromEnv(env) : null;

  let paypal: ReturnType<typeof loadPayPalConfig> | null = null;
  try {
    paypal = loadPayPalConfig(env);
  } catch {
    paypal = null; // payments disabled until credentials exist
  }

  const delay = Number(env.HAGGLEBOT_STEP_DELAY_MS ?? 1200);
  const runner = new NegotiationRunner({
    repo,
    llm,
    stepDelayMs: Number.isFinite(delay) && delay >= 0 ? Math.min(delay, 30_000) : 1200,
    log: (m, e) => console.error(m, e),
    sellerFor: (contact, initialAsk) => {
      const persona = PERSONAS.find((p) => p.id === contact.persona);
      if (!persona) throw new Error(`Unknown seller persona "${contact.persona}"`);
      return new PersonaSeller(persona, llm, initialAsk);
    },
  });
  runner.recoverInterrupted();

  const payments = new PaymentService({
    repo,
    runner,
    orders: paypal ? createOrdersController(paypal) : null,
    sellerEmail: paypal?.sellerEmail,
  });

  return { repo, runner, payments, publicConfig: { paypalClientId: paypal?.clientId ?? null, paypalBuyerEmail: paypal?.buyerEmail ?? null, llmMode: haveLlm ? "llm" : "template" } };
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
