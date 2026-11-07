import { describe, expect, it } from "vitest";
import { buildServices } from "../../server/services";
import { PERSONAS, scaledPersona } from "./personas";
import { PersonaSeller } from "./sellerAgent";

describe("scaledPersona", () => {
  it("leaves every persona exactly as written at the $250 demo budget", () => {
    for (const p of PERSONAS) expect(scaledPersona(p, 250)).toBe(p);
  });

  it("scales the list price and the cost together, so every ratio the persona relies on is kept", () => {
    const ferdi = PERSONAS.find((p) => p.id === "ferdi")!;
    const s = scaledPersona(ferdi, 120);
    expect(s.listPrice).toBe(Math.round(120 * 1.596));
    expect(s.costBasis / s.listPrice).toBeCloseTo(ferdi.costBasis / ferdi.listPrice, 2);
    expect(s.concessionRate).toBe(ferdi.concessionRate);
    expect(s.hiddenFeeRate).toBe(ferdi.hiddenFeeRate);
  });

  it("never lets a seller's floor drop below its cost, at any budget", () => {
    for (const budget of [20, 60, 120, 250, 900, 5000]) {
      for (const p of PERSONAS) {
        const seller = new PersonaSeller(scaledPersona(p, budget), null);
        const move = seller.plan(1);
        expect(move.price).toBeGreaterThanOrEqual(Math.ceil(scaledPersona(p, budget).costBasis));
      }
    }
  });

  it("ignores a missing or non-positive budget", () => {
    const p = PERSONAS[0]!;
    expect(scaledPersona(p, 0)).toBe(p);
    expect(scaledPersona(p, -5)).toBe(p);
  });
});

describe("a want that is not the $250 demo", () => {
  async function run(maxPrice: number, persona: string) {
    const svc = buildServices({ HAGGLEBOT_DB: ":memory:", HAGGLEBOT_STEP_DELAY_MS: "0" }); // no keys: template mode
    const want = svc.repo.createWant({ item: "Thing", maxPrice, notes: "", buyerName: "Alex" });
    svc.repo.addSeller({ wantId: want.id, name: persona, persona, endpoint: `mock://${persona}` });
    svc.runner.start(want.id);
    await svc.runner.idle();
    return svc.repo.listThreads(want.id)[0]!;
  }

  it("meets sellers near its own budget and can close a deal, instead of $399 sellers it can never afford", async () => {
    const t = await run(120, "ferdi");
    const firstAsk = t.messages.find((m) => m.from === "seller" && m.price !== null)!.price!;
    expect(firstAsk).toBeLessThan(250); // not the old 399
    expect(t.status).toBe("deal");
    expect(t.dealPrice!).toBeLessThanOrEqual(120);
  });

  it("still never goes over the budget", async () => {
    for (const budget of [60, 120, 900]) {
      const t = await run(budget, "chen");
      for (const m of t.messages.filter((x) => x.from === "buyer" && x.price !== null)) expect(m.price!).toBeLessThanOrEqual(budget);
      if (t.dealPrice !== null) expect(t.dealPrice).toBeLessThanOrEqual(budget);
    }
  });
});
