import type { LLM } from "../llm/types";
import { composeBuyerMessage } from "./compose";
import { fmt } from "./money";
import { detectScam } from "./scam";
import { decide, rulesFor, STYLE_INFO } from "./strategy";
import { SCAM_WALK_MESSAGE } from "./templates";
import { MAX_MESSAGES, type Message, type Seller, type Thread, type WalkReason, type Want } from "./types";

export interface EngineDeps {
  llm: LLM | null;
  /** How many sellers are being negotiated with in parallel (for truthful phrasing). */
  comparing?: number;
  now?: () => number;
  onMessage?: (thread: Thread, message: Message) => void;
}

export function createThread(want: Want, seller: Pick<Seller, "id" | "name">, id: string = `${want.id}:${seller.id}`): Thread {
  return {
    id, wantId: want.id, sellerId: seller.id, sellerName: seller.name, status: "negotiating",
    messages: [], lastOffer: null, lastAsk: null, refusals: 0, reason: null, detail: null, dealPrice: null,
  };
}

function push(thread: Thread, deps: EngineDeps, from: Message["from"], text: string, price: number | null, guard?: string): void {
  const message: Message = { from, text, at: (deps.now ?? Date.now)(), price, ...(guard ? { guard } : {}) };
  thread.messages.push(message);
  deps.onMessage?.(thread, message);
}

function walk(thread: Thread, reason: WalkReason, detail: string | null = null): void {
  thread.status = "walked_away";
  thread.reason = reason;
  thread.detail = detail;
}

const join = (...parts: (string | undefined)[]): string | undefined => parts.filter(Boolean).join(" ") || undefined;

function walkNote(reason: WalkReason, want: Want): string {
  switch (reason) {
    case "too_many_refusals":
      return `Walked away by rule: more than ${rulesFor(want).maxRefusals} refusals.`;
    case "over_budget":
      return "Walked away by rule: the price stayed above your budget.";
    case "message_limit":
      return `Walked away by rule: reached the ${MAX_MESSAGES}-message limit.`;
    case "scam_detected":
      return "Walked away by rule: scam signals.";
    case "purchased_elsewhere":
      return "Withdrew: bought from another seller.";
  }
}

/** Shown on the opening message so the user can see their haggling style being followed. */
function styleNote(want: Want, opening: number): string {
  const style = want.style ?? "balanced";
  const r = rulesFor(want);
  return `${STYLE_INFO[style].label} style: opens at ${fmt(opening)}, rises to your budget in ${r.rises} steps, walks away after more than ${r.maxRefusals} refusals.`;
}

/**
 * Advance a thread by one buyer move (and the seller's reply, if the thread continues).
 * No-op unless the thread is "negotiating".
 */
export async function step(thread: Thread, want: Want, seller: Seller, deps: EngineDeps): Promise<Thread> {
  if (thread.status !== "negotiating") return thread;
  const comparing = deps.comparing ?? 1;
  const move = decide(thread, want);

  if (move.type === "walk") {
    const c = await composeBuyerMessage(deps.llm, move, want, thread, { comparing });
    push(thread, deps, "buyer", c.text, null, join(c.guard, walkNote(move.reason, want)));
    walk(thread, move.reason);
    return thread;
  }

  if (move.type === "accept") {
    const c = await composeBuyerMessage(deps.llm, move, want, thread, { comparing });
    push(thread, deps, "buyer", c.text, move.price, join(c.guard, `Accepted ${fmt(move.price)} by rule: it is within your ${fmt(want.maxPrice)} budget.`));
    thread.status = "deal";
    thread.dealPrice = move.price;
    return thread;
  }

  // opening / counter: make the offer, then hear back.
  thread.lastOffer = move.price;
  const offer = await composeBuyerMessage(deps.llm, move, want, thread, { comparing });
  push(thread, deps, "buyer", offer.text, move.price, move.type === "opening" ? join(offer.guard, styleNote(want, move.price)) : offer.guard);
  const reply = await seller.respond({ want, history: thread.messages, buyerOffer: move.price });
  push(thread, deps, "seller", reply.message, reply.price);

  const agreed = reply.action === "accept" ? reply.price : null;
  const scam = detectScam(reply.message, agreed);
  if (scam.isScam) {
    push(thread, deps, "buyer", SCAM_WALK_MESSAGE, null, `Scam signals in the seller's message (${scam.signals.join("; ")}). Refused to pay outside PayPal and walked away.`);
    walk(thread, "scam_detected", scam.signals.join("; "));
    return thread;
  }

  if (reply.action === "accept") {
    // Seller took our offer: confirm and close.
    const price = reply.price ?? move.price;
    if (price > want.maxPrice) {
      walk(thread, "over_budget", `seller "accepted" at ${fmt(price)}`);
      return thread;
    }
    thread.lastAsk = price;
    const c = await composeBuyerMessage(deps.llm, { type: "accept", price }, want, thread, { comparing });
    push(thread, deps, "buyer", c.text, price, join(c.guard, `Accepted ${fmt(price)} by rule: it is within your ${fmt(want.maxPrice)} budget.`));
    thread.status = "deal";
    thread.dealPrice = price;
    return thread;
  }

  const prevAsk = thread.lastAsk;
  const refused = reply.action === "refuse" || (reply.price !== null && prevAsk !== null && reply.price >= prevAsk);
  if (refused) thread.refusals += 1;
  if (reply.price !== null) thread.lastAsk = reply.price;
  return thread;
}

export interface RunOptions {
  /** Checked before every step; true flips the thread to "paused" (the killswitch). */
  isPaused?: () => boolean;
  maxSteps?: number;
}

/** Drive a thread to a terminal state (or until paused). */
export async function runNegotiation(
  thread: Thread, want: Want, seller: Seller, deps: EngineDeps, opts: RunOptions = {},
): Promise<Thread> {
  for (let i = 0; i < (opts.maxSteps ?? 20) && thread.status === "negotiating"; i++) {
    if (opts.isPaused?.()) {
      thread.status = "paused";
      return thread;
    }
    await step(thread, want, seller, deps);
  }
  return thread;
}

export function resume(thread: Thread): void {
  if (thread.status === "paused") thread.status = "negotiating";
}
