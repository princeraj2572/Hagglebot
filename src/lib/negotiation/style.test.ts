import { describe, expect, it } from "vitest";
import { DEMO_WANT } from "../demo";
import { PERSONAS } from "../sellers/personas";
import { PersonaSeller } from "../sellers/sellerAgent";
import { createThread, runNegotiation } from "./engine";
import { decide, nextOffer, openingOffer, STYLE_RULES } from "./strategy";
import { NEGOTIATION_STYLES, type NegotiationStyle, type Thread } from "./types";

const withStyle = (style: NegotiationStyle) => ({ ...DEMO_WANT, style });
const thread = (over: Partial<Thread>): Thread => ({
  id: "t", wantId: "w", sellerId: "s", sellerName: "S", status: "negotiating", messages: [],
  lastOffer: null, lastAsk: null, refusals: 0, reason: null, detail: null, dealPrice: null, ...over,
});

describe("negotiation styles: strategy", () => {
  it("balanced is the original behaviour: no style set means balanced", () => {
    expect(openingOffer(DEMO_WANT)).toBe(175);
    expect(openingOffer(withStyle("balanced"))).toBe(175);
    expect(STYLE_RULES.balanced).toEqual({ anchor: 0.7, rises: 5, maxRefusals: 3 });
  });

  it("patient opens lower than balanced, which opens lower than quick", () => {
    const [p, b, q] = (["patient", "balanced", "quick"] as const).map((s) => openingOffer(withStyle(s)));
    expect(p).toBe(150);
    expect(q).toBe(200);
    expect(p!).toBeLessThan(b!);
    expect(b!).toBeLessThan(q!);
  });

  it("every style climbs to the budget and never above it", () => {
    for (const style of NEGOTIATION_STYLES) {
      const want = withStyle(style);
      let offer: number | null = null;
      for (let i = 0; i < 20; i++) {
        offer = nextOffer(want, offer);
        expect(offer).toBeLessThanOrEqual(want.maxPrice);
      }
      expect(offer).toBe(want.maxPrice);
    }
  });

  it("quick walks after 2 refusals, balanced after 3, patient after 4", () => {
    const refusalsToWalk = (style: NegotiationStyle) => {
      for (let r = 0; r < 10; r++) {
        const move = decide(thread({ refusals: r, lastOffer: 200, lastAsk: 399 }), withStyle(style));
        if (move.type === "walk" && move.reason === "too_many_refusals") return r;
      }
      return -1;
    };
    expect(refusalsToWalk("quick")).toBe(3);
    expect(refusalsToWalk("balanced")).toBe(4);
    expect(refusalsToWalk("patient")).toBe(5);
  });
});

describe("negotiation styles: whole conversations (template mode)", () => {
  const run = async (id: string, style: NegotiationStyle) => {
    const want = withStyle(style);
    const seller = new PersonaSeller(PERSONAS.find((p) => p.id === id)!, null);
    const t = createThread(want, seller);
    await runNegotiation(t, want, seller, { llm: null, comparing: 4 });
    return t;
  };

  it("no style ever pays above the budget", async () => {
    for (const style of NEGOTIATION_STYLES) {
      for (const p of PERSONAS) {
        const t = await run(p.id, style);
        if (t.dealPrice !== null) expect(t.dealPrice).toBeLessThanOrEqual(DEMO_WANT.maxPrice);
      }
    }
  });

  it("quick gives up on a stubborn seller sooner than patient", async () => {
    // Quick reaches the budget in 3 steps and then leaves; patient keeps trying for longer.
    const quick = await run("fatima", "quick");
    const patient = await run("fatima", "patient");
    expect(quick.status).toBe("walked_away");
    expect(patient.status).toBe("walked_away");
    expect(quick.messages.length).toBeLessThan(patient.messages.length);
  });

  it("the opening message records which style is being followed", async () => {
    const t = await run("ferdi", "patient");
    expect(t.messages[0]!.guard).toContain("Patient style: opens at $150");
    expect(t.messages[0]!.guard).toContain("more than 4 refusals");
  });

  it("the walk-away note uses the style's own refusal limit", async () => {
    const t = await run("fatima", "patient");
    expect(t.reason).toBe("too_many_refusals");
    const last = t.messages.filter((m) => m.from === "buyer").at(-1)!;
    expect(last.guard).toContain("more than 4 refusals");
  });
});
