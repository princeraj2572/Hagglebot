import { describe, expect, it } from "vitest";
import { PERSONAS } from "./personas";
import { PersonaSeller } from "./sellerAgent";

const want = { id: "w", item: "headphones", maxPrice: 250, notes: "", buyerName: "Alex" };

describe("PersonaSeller pricing", () => {
  it.each(PERSONAS)("$name never accepts or asks below its floor", async (persona) => {
    const s = new PersonaSeller(persona, null);
    const floor = Math.ceil(persona.costBasis * persona.floorMultiple);
    for (const offer of [1, 50, floor - 1, floor, floor + 10, 300, 400]) {
      const fresh = new PersonaSeller(persona, null);
      const m = fresh.plan(offer);
      if (m.action === "accept") expect(m.price).toBeGreaterThanOrEqual(floor);
      expect(m.price).toBeGreaterThanOrEqual(floor);
    }
    const r = await s.respond({ want, history: [], buyerOffer: null });
    expect(r.price).toBe(persona.listPrice);
  });

  it("only Shady Sam adds fees at close", () => {
    for (const p of PERSONAS) {
      const m = new PersonaSeller(p, null).plan(399);
      expect(m.action).toBe("accept");
      expect(m.fee > 0).toBe(p.hiddenFeeRate > 0);
    }
  });

  it("asks fall monotonically as offers rise", () => {
    const s = new PersonaSeller(PERSONAS[0]!, null);
    let prev = Infinity;
    for (const offer of [175, 190, 205]) {
      const m = s.plan(offer);
      expect(m.price).toBeLessThanOrEqual(prev);
      prev = m.price;
    }
  });
});
