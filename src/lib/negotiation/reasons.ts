import type { WalkReason } from "./types";

/** Plain-language outcome for each reason a negotiation ended without a deal. */
export const REASON_TEXT: Record<WalkReason, string> = {
  too_many_refusals: "Walked away: the seller kept refusing",
  scam_detected: "Walked away: scam detected",
  over_budget: "Walked away: price stayed above budget",
  message_limit: "Walked away: message limit reached",
  purchased_elsewhere: "Withdrew: bought from another seller",
  declined_by_user: "Withdrew: you declined this price",
};
