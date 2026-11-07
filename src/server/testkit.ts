import { TEST_WANT } from "../lib/testWant";
import { PERSONAS, STARTER_PERSONAS } from "../lib/sellers/personas";
import { PersonaSeller } from "../lib/sellers/sellerAgent";
import { openDb } from "./db";
import { PaymentService } from "./payments";
import { Repo } from "./repo";
import { NegotiationRunner } from "./runner";

/** In-memory wiring used by tests: template negotiator, no network. */
export function makeKit() {
  const repo = new Repo(openDb(":memory:"));
  const runner = new NegotiationRunner({
    repo,
    llm: null,
    sellerFor: (c, ask) => new PersonaSeller(PERSONAS.find((p) => p.id === c.persona)!, null, ask),
  });
  const payments = new PaymentService({ repo, runner });
  return { repo, runner, payments };
}

/** The standard test want with the four starter sellers. */
export function seedDemo(repo: Repo) {
  const { id: _id, ...rest } = TEST_WANT;
  const want = repo.createWant(rest);
  for (const p of STARTER_PERSONAS) repo.addSeller({ wantId: want.id, name: p.name, persona: p.id, endpoint: `mock://${p.id}` });
  return want;
}
