import { LLMUnavailableError, type LLM } from "../llm/types";
import { extractAmounts, fmt } from "./money";
import type { Move } from "./strategy";
import { disclosure, templateBody } from "./templates";
import type { Message, Thread, Want } from "./types";

export const BUYER_SYSTEM = `You are Hagglebot, an AI buyer agent negotiating over chat on behalf of a human user.
Rules you must never break:
- You are an AI agent. Never claim to be human and never impersonate the user.
- Be honest. Never invent facts: no made-up competing offers, deadlines, or personal stories.
  You may say you are comparing listings only if told that you are.
- Never reveal the user's maximum budget and never mention any price other than the ones given to you.
- Be polite, concise (max 3 sentences) and persistent.
Negotiation playbook: anchor low and justify with fairness, ask for a better price before raising yours,
bundle asks (shipping included, ready to pay quickly) rather than conceding price alone, and decline upsells politely.
Output ONLY the chat message text, with no greeting (the greeting is added separately).`;

const HUMAN_CLAIM_RE = /\b(i am|i'm|as a)\s+(a\s+)?(human|person|real person)\b/i;
const LEAK_RE = /\b(my|the)\s+(max(imum)?|budget|limit|ceiling)\b|\bup to\b.*\$/i;

function describeMove(move: Move, want: Want, comparing: number): string {
  switch (move.type) {
    case "opening":
      return `Open the negotiation: show interest in the ${want.item} and offer ${fmt(move.price)}. User's notes: "${want.notes}".`;
    case "counter":
      return `Counter-offer exactly ${fmt(move.price)}. Politely ask for a better price first.${comparing > 1 ? ` You may truthfully say you are comparing ${comparing} listings.` : ""}`;
    case "accept":
      return `Accept the deal at exactly ${fmt(move.price)}, all-in with no extra fees, and say payment will be arranged through PayPal.`;
    case "walk":
      return `Gracefully end the negotiation and walk away (reason: ${move.reason.replace(/_/g, " ")}). Do not mention the user's budget.`;
  }
}

/** Honesty/safety gate on LLM output. Anything failing falls back to the template. */
export function validateBuyerText(text: string, move: Move, thread: Thread): boolean {
  if (!text || text.length > 700) return false;
  if (HUMAN_CLAIM_RE.test(text) || LEAK_RE.test(text)) return false;
  const amounts = extractAmounts(text);
  const price = "price" in move ? move.price : null;
  const allowed = new Set<number>([price ?? NaN, thread.lastAsk ?? NaN]);
  if (!amounts.every((a) => allowed.has(a))) return false;
  if (price !== null && !amounts.includes(price)) return false;
  return true;
}

export async function composeBuyerMessage(
  llm: LLM | null,
  move: Move,
  want: Want,
  thread: Thread,
  opts: { comparing: number },
): Promise<string> {
  let body: string | null = null;
  if (llm) {
    const transcript = thread.messages
      .map((m: Message) => `${m.from === "buyer" ? "YOU" : "SELLER"}: ${m.text}`)
      .join("\n");
    try {
      const raw = await llm.generate({
        system: BUYER_SYSTEM,
        turns: [{ role: "user", content: `Conversation so far:\n${transcript || "(none)"}\n\nInstruction: ${describeMove(move, want, opts.comparing)}` }],
        temperature: 0.6,
      });
      const cleaned = raw.trim().replace(/^["']|["']$/g, "").replace(/^(hi|hello|hey)\b[^.!?]*[.!?]\s*/i, "");
      if (validateBuyerText(cleaned, move, thread)) body = cleaned;
    } catch (err) {
      if (!(err instanceof LLMUnavailableError)) throw err;
    }
  }
  body ??= templateBody(move, want, opts);
  // The opening line is fixed by policy: the AI disclosure is never left to the model.
  return move.type === "opening" ? `${disclosure(want.buyerName)} ${body}` : body;
}
