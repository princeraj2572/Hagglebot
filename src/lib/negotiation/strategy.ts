import { MAX_MESSAGES, MAX_REFUSALS, type NegotiationStyle, type Thread, type Want } from "./types";

export interface StyleRules {
  /** Opening offer as a fraction of the budget. */
  anchor: number;
  /** How many equal rises take the offer from the anchor to the budget. */
  rises: number;
  /** Walk away after more than this many refusals. */
  maxRefusals: number;
}

/** The three ways to haggle. "balanced" is the original behaviour. None of them can exceed the budget. */
export const STYLE_RULES: Record<NegotiationStyle, StyleRules> = {
  patient: { anchor: 0.6, rises: 6, maxRefusals: MAX_REFUSALS + 1 },
  balanced: { anchor: 0.7, rises: 5, maxRefusals: MAX_REFUSALS },
  quick: { anchor: 0.8, rises: 3, maxRefusals: MAX_REFUSALS - 1 },
};

export const STYLE_INFO: Record<NegotiationStyle, { label: string; description: string }> = {
  patient: { label: "Patient", description: "Opens low and concedes slowly. Takes longer and can win a lower price." },
  balanced: { label: "Balanced", description: "Opens at 70% of your budget and meets sellers in the middle." },
  quick: { label: "Quick", description: "Opens higher and closes sooner. Walks away from stubborn sellers faster." },
};

export const rulesFor = (want: Want): StyleRules => STYLE_RULES[want.style ?? "balanced"];

/** Lowball anchor (70% of budget when balanced), rounded to whole dollars. */
export function openingOffer(want: Want): number {
  return Math.max(1, Math.round(want.maxPrice * rulesFor(want).anchor));
}

/** Concession step: climb from the anchor to the budget in a few rises (5 when balanced). */
export function offerStep(want: Want): number {
  return Math.max(1, Math.round((want.maxPrice - openingOffer(want)) / rulesFor(want).rises));
}

export function nextOffer(want: Want, lastOffer: number | null): number {
  if (lastOffer === null) return openingOffer(want);
  return Math.min(want.maxPrice, lastOffer + offerStep(want));
}

export type Move =
  | { type: "opening"; price: number }
  | { type: "counter"; price: number }
  | { type: "accept"; price: number }
  | { type: "walk"; reason: "too_many_refusals" | "over_budget" | "message_limit" };

/**
 * Pure decision function: given the thread so far, what does the buyer do next?
 * All money rules live here, in code, so no prompt can talk the bot into overpaying.
 */
export function decide(thread: Thread, want: Want): Move {
  if (thread.refusals > rulesFor(want).maxRefusals) return { type: "walk", reason: "too_many_refusals" };

  const ask = thread.lastAsk;
  const planned = nextOffer(want, thread.lastOffer);
  const withinBudget = ask !== null && ask <= want.maxPrice;

  // Never offer more than the seller is asking: take the ask if it is within reach.
  if (ask !== null && withinBudget && ask <= planned) return { type: "accept", price: ask };

  // Final message slot: close if affordable, otherwise leave.
  if (thread.messages.length >= MAX_MESSAGES - 1) {
    return withinBudget && ask !== null
      ? { type: "accept", price: ask }
      : { type: "walk", reason: "message_limit" };
  }

  // Already at the ceiling and the seller is still above it.
  if (thread.lastOffer !== null && thread.lastOffer >= want.maxPrice && !withinBudget) {
    return { type: "walk", reason: "over_budget" };
  }

  return thread.lastOffer === null
    ? { type: "opening", price: planned }
    : { type: "counter", price: planned };
}
