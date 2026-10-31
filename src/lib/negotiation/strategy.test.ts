import { describe, expect, it } from "vitest";
import { decide, nextOffer, openingOffer, offerStep } from "./strategy";
import { MAX_MESSAGES, type Message, type Thread, type Want } from "./types";

const want: Want = { id: "w", item: "headphones", maxPrice: 250, notes: "", buyerName: "Alex" };
const msgs = (n: number): Message[] =>
  Array.from({ length: n }, (_, i) => ({ from: i % 2 ? "seller" : "buyer", text: "x", at: i, price: null }));
const thread = (p: Partial<Thread> = {}): Thread => ({
  id: "t", wantId: "w", sellerId: "s", sellerName: "S", status: "negotiating", messages: [],
  lastOffer: null, lastAsk: null, refusals: 0, reason: null, detail: null, dealPrice: null, ...p,
});

describe("offer ladder", () => {
  it("anchors at 70% and climbs to the budget in 5 steps without exceeding it", () => {
    expect(openingOffer(want)).toBe(175);
    expect(offerStep(want)).toBe(15);
    let o: number | null = null;
    const seen: number[] = [];
    for (let i = 0; i < 9; i++) {
      o = nextOffer(want, o);
      seen.push(o);
    }
    expect(seen.slice(0, 6)).toEqual([175, 190, 205, 220, 235, 250]);
    expect(Math.max(...seen)).toBe(250);
  });
});

describe("decide", () => {
  it("opens with the lowball", () => {
    expect(decide(thread(), want)).toEqual({ type: "opening", price: 175 });
  });
  it("counters while the ask is above the planned offer", () => {
    expect(decide(thread({ lastOffer: 175, lastAsk: 300, messages: msgs(2) }), want)).toEqual({ type: "counter", price: 190 });
  });
  it("accepts the ask rather than offering more than it", () => {
    expect(decide(thread({ lastOffer: 235, lastAsk: 246, messages: msgs(10) }), want)).toEqual({ type: "accept", price: 246 });
  });
  it("never accepts above budget", () => {
    const m = decide(thread({ lastOffer: 250, lastAsk: 251, messages: msgs(8) }), want);
    expect(m).toEqual({ type: "walk", reason: "over_budget" });
  });
  it("walks after more than 3 refusals", () => {
    expect(decide(thread({ refusals: 4, lastOffer: 220, lastAsk: 300, messages: msgs(8) }), want)).toEqual({
      type: "walk",
      reason: "too_many_refusals",
    });
    expect(decide(thread({ refusals: 3, lastOffer: 220, lastAsk: 300, messages: msgs(8) }), want).type).toBe("counter");
  });
  it("uses the last message slot to close or leave, never exceeding 15 messages", () => {
    const base = { lastOffer: 220, messages: msgs(MAX_MESSAGES - 1) };
    expect(decide(thread({ ...base, lastAsk: 249 }), want)).toEqual({ type: "accept", price: 249 });
    expect(decide(thread({ ...base, lastAsk: 300 }), want)).toEqual({ type: "walk", reason: "message_limit" });
  });
});
