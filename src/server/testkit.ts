import type { OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";
import { TEST_WANT } from "../lib/testWant";
import { PERSONAS, STARTER_PERSONAS } from "../lib/sellers/personas";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";

/** In-memory wiring used by tests: template negotiator, no network. Pass fake PayPal controllers to test real payments. */
export function makeKit(orders: OrdersController | null = null, paymentsApi: PaymentsController | null = null) {
  const repo = new Repo(openDb(":memory:"));
  const runner = new NegotiationRunner({
    repo,
    llm: null,
    sellerFor: (c, ask) => new PersonaSeller(PERSONAS.find((p) => p.id === c.persona)!, null, ask),
  });
  const payments = new PaymentService({ repo, runner, orders, paymentsApi, sellerEmail: orders ? "seller@example.com" : undefined });
  return { repo, runner, payments };
}

/** The standard test want with the four starter sellers. */
export function seedDemo(repo: Repo) {
  const { id: _id, ...rest } = TEST_WANT;
  const want = repo.createWant(rest);
  for (const p of STARTER_PERSONAS) repo.addSeller({ wantId: want.id, name: p.name, persona: p.id, endpoint: `mock://${p.id}` });
  return want;
}
