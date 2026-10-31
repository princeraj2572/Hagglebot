import { describe, expect, it } from "vitest";
import { detectScam } from "./scam";

describe("detectScam", () => {
  it("passes an honest message", () => {
    expect(detectScam("Happy to do $205, shipping is free and I'll send it Monday.", 205)).toEqual({ isScam: false, signals: [] });
  });
  it("flags hidden fees but not negated ones", () => {
    expect(detectScam("Deal at $220, plus a $25 processing fee.").isScam).toBe(true);
    expect(detectScam("There is no handling fee, price is final.").isScam).toBe(false);
  });
  it("flags off-platform payment", () => {
    expect(detectScam("Just pay me directly via Zelle or gift card").isScam).toBe(true);
  });
  it("flags bait-and-switch totals against the agreed price", () => {
    const r = detectScam("Sold at $220! Your total comes to $245 with extras.", 220);
    expect(r.isScam).toBe(true);
    expect(r.signals.join()).toMatch(/bait-and-switch/);
  });
  it("treats urgency alone as a warning, not disqualifying", () => {
    const r = detectScam("Act now, I have other buyers.");
    expect(r.signals).toHaveLength(1);
    expect(r.isScam).toBe(false);
  });
});
