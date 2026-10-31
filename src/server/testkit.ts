import { DEMO_WANT } from "../lib/demo";
import { PERSONAS } from "../lib/sellers/personas";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";
import type { OrdersController } from "@paypal/paypal-server-sdk";

/** In-memory wiring used by tests: template mode, no network. */
export function makeKit(orders: OrdersController | null = null) {
  const repo = new Repo(openDb(":memory:"));
  const runner = new NegotiationRunner({
    repo,
    llm: null,
    sellerFor: (c, ask) => new PersonaSeller(PERSONAS.find((p) => p.id === c.persona)!, null, ask),
  });
  const payments = new PaymentService({ repo, runner, orders, sellerEmail: "seller@example.com" });
  return { repo, runner, payments };
}

export function seedDemo(repo: Repo) {
  const { id: _id, ...rest } = DEMO_WANT;
  const want = repo.createWant(rest);
  for (const p of PERSONAS) repo.addSeller({ wantId: want.id, name: p.name, persona: p.id, endpoint: `mock://${p.id}` });
  return want;
}
