import type { WalkReason } from "@/lib/negotiation/types";

export const usd = (n: number | null | undefined): string => (n === null || n === undefined ? "–" : `$${n.toLocaleString("en-US")}`);

export const REASON_LABEL: Record<WalkReason, string> = {
  too_many_refusals: "Walked away: the seller kept refusing",
  scam_detected: "Walked away: scam detected",
  over_budget: "Walked away: price stayed above budget",
  message_limit: "Walked away: message limit reached",
  purchased_elsewhere: "Withdrew: bought from another seller",
  declined_by_user: "Withdrew: you declined this price",
};

export const time = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
