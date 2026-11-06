import { DEMO_WANT } from "../lib/demo";
import { DEMO_PERSONAS, PERSONAS } from "../lib/sellers/personas";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";
import type { OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";

/** In-memory wiring used by tests: template mode, no network. */
export function makeKit(orders: OrdersController | null = null, paymentsApi: PaymentsController | null = null) {
  const repo = new Repo(openDb(":memory:"));
  const runner = new NegotiationRunner({
    repo,
    llm: null,
    sellerFor: (c, ask) => new PersonaSeller(PERSONAS.find((p) => p.id === c.persona)!, null, ask),
  });
  const payments = new PaymentService({ repo, runner, orders, paymentsApi, sellerEmail: "seller@example.com" });
  return { repo, runner, payments };
}

export function seedDemo(repo: Repo) {
  const { id: _id, ...rest } = DEMO_WANT;
  const want = repo.createWant(rest);
  for (const p of DEMO_PERSONAS) repo.addSeller({ wantId: want.id, name: p.name, persona: p.id, endpoint: `mock://${p.id}` });
  return want;
}
