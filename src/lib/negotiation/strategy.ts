import { MAX_MESSAGES, MAX_REFUSALS, type Thread, type Want } from "./types";

/** Lowball anchor: 70% of budget, rounded to whole dollars. */
export function openingOffer(want: Want): number {
  return Math.max(1, Math.round(want.maxPrice * 0.7));
}

/** Concession step: climb from the anchor to the budget in 5 rises. */
export function offerStep(want: Want): number {
  return Math.max(1, Math.round((want.maxPrice - openingOffer(want)) / 5));
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
  if (thread.refusals > MAX_REFUSALS) return { type: "walk", reason: "too_many_refusals" };

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
