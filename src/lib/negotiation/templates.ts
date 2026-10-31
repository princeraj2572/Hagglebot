import { fmt } from "./money";
import type { Move } from "./strategy";
import type { Want } from "./types";

export function disclosure(buyerName: string): string {
  return `Hi, I'm an AI buyer agent for ${buyerName}. May I ask about your listing?`;
}

/** Plain templates: the degraded mode when no LLM is reachable. */
export function templateBody(move: Move, want: Want, opts: { comparing: number }): string {
  switch (move.type) {
    case "opening": {
      const notes = want.notes.trim() ? ` What matters to ${want.buyerName}: ${want.notes.trim()}.` : "";
      return `I'm interested in your ${want.item}.${notes} Would you consider ${fmt(move.price)}?`;
    }
    case "counter": {
      const extra = opts.comparing > 1 ? " I'm comparing a few listings, so I can move quickly at a fair price." : "";
      return `Thanks for your reply. I can offer ${fmt(move.price)} for the ${want.item}.${extra}`;
    }
    case "accept":
      return `That works. We have a deal at ${fmt(move.price)} for the ${want.item}, all-in with no extra fees. I'll arrange payment through PayPal and confirm here once it's done.`;
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
  "Thank you, but I can't accept additional fees or off-platform payment: the price we agreed was all-in, and payments go through PayPal only. I'm going to step away from this listing.";
