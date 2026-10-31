import type { LLM } from "../llm/types";
import { composeBuyerMessage } from "./compose";
import { fmt } from "./money";
import { detectScam } from "./scam";
import { decide } from "./strategy";
import { SCAM_WALK_MESSAGE } from "./templates";
import type { Message, Seller, Thread, WalkReason, Want } from "./types";

export interface EngineDeps {
  llm: LLM | null;
  /** How many sellers are being negotiated with in parallel (for truthful phrasing). */
  comparing?: number;
  now?: () => number;
  onMessage?: (thread: Thread, message: Message) => void;
}

export function createThread(want: Want, seller: Seller, id: string = `${want.id}:${seller.id}`): Thread {
  return {
    id, wantId: want.id, sellerId: seller.id, sellerName: seller.name, status: "negotiating",
    messages: [], lastOffer: null, lastAsk: null, refusals: 0, reason: null, detail: null, dealPrice: null,
  };
}

function push(thread: Thread, deps: EngineDeps, from: Message["from"], text: string, price: number | null): void {
  const message: Message = { from, text, at: (deps.now ?? Date.now)(), price };
  thread.messages.push(message);
  deps.onMessage?.(thread, message);
}

function walk(thread: Thread, reason: WalkReason, detail: string | null = null): void {
  thread.status = "walked_away";
  thread.reason = reason;
  thread.detail = detail;
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
    push(thread, deps, "buyer", await composeBuyerMessage(deps.llm, move, want, thread, { comparing }), null);
    walk(thread, move.reason);
    return thread;
  }

  if (move.type === "accept") {
    push(thread, deps, "buyer", await composeBuyerMessage(deps.llm, move, want, thread, { comparing }), move.price);
    thread.status = "deal";
    thread.dealPrice = move.price;
    return thread;
  }

  // opening / counter: make the offer, then hear back.
  thread.lastOffer = move.price;
  push(thread, deps, "buyer", await composeBuyerMessage(deps.llm, move, want, thread, { comparing }), move.price);
  const reply = await seller.respond({ want, history: thread.messages, buyerOffer: move.price });
  push(thread, deps, "seller", reply.message, reply.price);

  const agreed = reply.action === "accept" ? reply.price : null;
  const scam = detectScam(reply.message, agreed);
  if (scam.isScam) {
    push(thread, deps, "buyer", SCAM_WALK_MESSAGE, null);
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
    push(thread, deps, "buyer", await composeBuyerMessage(deps.llm, { type: "accept", price }, want, thread, { comparing }), price);
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
