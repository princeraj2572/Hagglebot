import { composeBuyerMessage } from "./compose";
import { createThread } from "./engine";
import { detectInjection, injectionNote } from "./injection";
import { extractAmounts, fmt } from "./money";
import { detectScam } from "./scam";
import { decide } from "./strategy";
import { SCAM_WALK_MESSAGE } from "./templates";
import type { Message, Want } from "./types";

export interface CopilotTurn {
  from: "buyer" | "seller";
  text: string;
  price: number | null;
}

export interface CopilotDraft {
  text: string;
  price: number | null;
  status: "negotiating" | "deal" | "walked_away";
  /** Guardrail notes: why this draft says what it says, and anything spotted in the seller's last reply. */
  notes: string[];
}

/**
 * Haggle copilot: the same engine, but the person sends every message themselves on a real marketplace.
 * `history` is the chat so far (our drafts and the seller's pasted replies); the listing's asking price
 * counts as the seller's first ask. Returns the next message to send.
 */
export async function copilotNext(want: Want, askingPrice: number, history: CopilotTurn[]): Promise<CopilotDraft> {
  const thread = createThread(want, { id: "copilot", name: "Seller" });
  thread.lastAsk = askingPrice;
  const notes: string[] = [];
  for (const h of history) {
    const price = h.from === "seller" ? (h.price ?? extractAmounts(h.text).at(-1) ?? null) : h.price;
    thread.messages.push({ from: h.from, text: h.text, price, at: 0 } satisfies Message);
    if (h.from === "buyer") {
      if (price !== null) thread.lastOffer = price;
      continue;
    }
    // A reply with no lower price is the seller holding firm.
    if (price === null || (thread.lastAsk !== null && price >= thread.lastAsk)) thread.refusals += 1;
    if (price !== null) thread.lastAsk = price;
  }

  const last = history.at(-1);
  if (last?.from === "seller") {
    const injection = detectInjection(last.text);
    if (injection.length > 0) notes.push(injectionNote(injection));
    const scam = detectScam(last.text, thread.lastOffer);
    if (scam.isScam) {
      notes.push(`Scam signals in the seller's reply (${scam.signals.join("; ")}). Don't pay outside the platform: walk away.`);
      return { text: SCAM_WALK_MESSAGE, price: null, status: "walked_away", notes };
    }
  }

  const move = decide(thread, want);
  const c = await composeBuyerMessage(null, move, want, thread, { comparing: 1 });
  if (c.guard) notes.push(c.guard);
  if (move.type === "walk") return { text: c.text, price: null, status: "walked_away", notes: [...notes, `Walk away by rule (${move.reason.replace(/_/g, " ")}).`] };
  if (move.type === "accept") return { text: c.text, price: move.price, status: "deal", notes: [...notes, `Accept ${fmt(move.price)}: it is within your ${fmt(want.maxPrice)} budget.`] };
  return { text: c.text, price: move.price, status: "negotiating", notes };
}
