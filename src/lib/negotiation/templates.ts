import { fmt } from "./money";
import type { Move } from "./strategy";
import type { Want } from "./types";

export function disclosure(buyerName: string): string {
  return `Hi, I'm an AI buyer agent for ${buyerName}. May I ask about your listing?`;
}

/** Plain templates: the degraded mode when no LLM is reachable. */
const COUNTER_VARIANTS: ((price: string, item: string, extra: string) => string)[] = [
  (price, item, extra) => `Thanks for your reply. I can offer ${price} for the ${item}.${extra}`,
  (price) => `I appreciate you coming down. Could we settle at ${price}?`,
  (price) => `That's closer. I'm ready to pay right away at ${price}, if that works for you.`,
  (price) => `We're nearly there. Would ${price} with shipping included do it?`,
  (price) => `Thanks for working with me on this. How does ${price} sound?`,
];

export function templateBody(move: Move, want: Want, opts: { comparing: number; turn?: number }): string {
  switch (move.type) {
    case "opening": {
      const notes = want.notes.trim() ? ` What matters to ${want.buyerName}: ${want.notes.trim()}.` : "";
      return `I'm interested in your ${want.item}.${notes} Would you consider ${fmt(move.price)}?`;
    }
    case "counter": {
      const extra = opts.comparing > 1 ? " I'm comparing a few listings, so I can move quickly at a fair price." : "";
      const pick = COUNTER_VARIANTS[Math.max(0, (opts.turn ?? 1) - 1) % COUNTER_VARIANTS.length]!;
      return pick(fmt(move.price), want.item, extra);
    }
    case "accept":
      return `That works. We have a deal at ${fmt(move.price)} for the ${want.item}, all-in with no extra fees. I'll arrange payment through the platform and confirm here once it's done.`;
    case "walk":
      switch (move.reason) {
        case "too_many_refusals":
          return "Thank you for your time. It looks like we can't find a price that works, so I'll step away. Best of luck with the sale!";
        case "over_budget":
          return `Thanks for your time. That's above what ${want.buyerName} can spend, so I'll step away. All the best!`;
        case "message_limit":
          return "Thanks for the conversation. We haven't been able to settle on a price in the time I have, so I'll step away. All the best!";
      }
  }
}

export const SCAM_WALK_MESSAGE =
  "Thank you, but I can't accept additional fees or off-platform payment: the price we agreed was all-in, and payments go through this platform only. I'm going to step away from this listing.";
