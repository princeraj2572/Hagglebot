export interface Want {
  id: string;
  item: string;
  /** Hard budget ceiling in whole dollars. Never revealed, never exceeded. */
  maxPrice: number;
  notes: string;
  /** Name used in the mandatory AI-disclosure opening line. */
  buyerName: string;
}

export interface Message {
  from: "buyer" | "seller";
  text: string;
  at: number;
  /** The price this message puts on the table, if any. */
  price: number | null;
  /** A guardrail that shaped this message (shown to the user, never sent to the seller). */
  guard?: string;
}

export type SellerAction = "counter" | "accept" | "refuse";

export interface SellerReply {
  message: string;
  /** Seller's current asking price (or the agreed price on accept). */
  price: number | null;
  action: SellerAction;
}

export interface SellerContext {
  want: Want;
  history: Message[];
  buyerOffer: number | null;
}

export interface Seller {
  readonly id: string;
  readonly name: string;
  respond(ctx: SellerContext): Promise<SellerReply>;
}

export type ThreadStatus = "negotiating" | "deal" | "walked_away" | "paused";
export type WalkReason =
  | "scam_detected"
  | "too_many_refusals"
  | "over_budget"
  | "message_limit"
  | "purchased_elsewhere";

export interface Thread {
  id: string;
  wantId: string;
  sellerId: string;
  sellerName: string;
  status: ThreadStatus;
  messages: Message[];
  lastOffer: number | null;
  lastAsk: number | null;
  refusals: number;
  reason: WalkReason | null;
  /** Human-readable detail, e.g. the scam signals found. */
  detail: string | null;
  dealPrice: number | null;
}

/** Hard limits from the safety spec. */
export const MAX_MESSAGES = 15;
export const MAX_REFUSALS = 3;
