import { describe, expect, it } from "vitest";
import { dealSavings } from "./savings";
import type { Message, Thread } from "./types";

const msg = (from: Message["from"], price: number | null): Message => ({ from, text: "", at: 0, price });
const thread = (over: Partial<Thread>): Thread => ({
  id: "t", wantId: "w", sellerId: "s", sellerName: "Seller", status: "deal", messages: [], lastOffer: null, lastAsk: null,
  refusals: 0, reason: null, detail: null, dealPrice: null, ...over,
});

describe("dealSavings", () => {
  it("is null until a deal closes", () => {
    expect(dealSavings([], 250)).toBeNull();
    expect(dealSavings([thread({ status: "negotiating" }), thread({ status: "walked_away" })], 250)).toBeNull();
  });

  it("measures each deal against the seller's first ask and the budget, cheapest first", () => {
    const a = thread({ sellerName: "A", dealPrice: 205, messages: [msg("buyer", 175), msg("seller", 240), msg("seller", 215)] });
    const b = thread({ sellerName: "B", dealPrice: 175, messages: [msg("seller", 175)] });
    const out = dealSavings([a, b, thread({ status: "walked_away", dealPrice: null })], 250)!;
    expect(out.rows.map((r) => r.seller)).toEqual(["B", "A"]);
    expect(out.best.seller).toBe("B");
    expect(out.rows[1]).toEqual({ seller: "A", firstAsk: 240, price: 205, saved: 35, savedPct: 15, underBudget: 45, direct: false });
    expect(out.best).toMatchObject({ saved: 0, savedPct: 0, underBudget: 75 });
  });

  it("marks a purchase made at the listed price, without negotiating", () => {
    const direct = thread({ dealPrice: 120, messages: [msg("seller", 120), { ...msg("buyer", 120), guard: "Bought at the listed price by your choice." }] });
    expect(dealSavings([direct], 300)!.best.direct).toBe(true);
  });

  it("never reports a negative saving and copes with a missing ask", () => {
    const odd = thread({ dealPrice: 300, messages: [msg("seller", 280)] });
    const none = thread({ sellerName: "N", dealPrice: 100, messages: [msg("buyer", 90)] });
    const rows = dealSavings([odd, none], 250)!.rows;
    expect(rows.find((r) => r.price === 300)).toMatchObject({ saved: 0, underBudget: 0 });
    expect(rows.find((r) => r.seller === "N")).toMatchObject({ firstAsk: 100, saved: 0 });
  });
});
