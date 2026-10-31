import { extractAmounts } from "./money";

export interface ScamResult {
  isScam: boolean;
  signals: string[];
}

const FEE_RE =
  /\b(processing|handling|service|booking|insurance|admin(?:istrative)?|platform|convenience|transaction|release)\s+(?:fee|charge)s?\b/gi;
const NEGATION_RE = /\b(no|zero|without|free of|waive[ds]?|not charge)\b[^.]{0,20}$/i;

const OFF_PLATFORM_RE =
  /gift\s*cards?|wire\s+transfer|western\s+union|bitcoin|crypto(?:currency)?|zelle|venmo|cash\s*app|friends\s*(?:and|&)\s*family|outside\s+(?:of\s+)?paypal|off[- ]platform|pay\s+(?:me\s+)?directly|bank\s+transfer/i;

const PRESSURE_RE =
  /act\s+now|last\s+chance|only\s+(?:today|the\s+next\s+hour)|someone\s+else\s+is\s+(?:buying|paying)|offer\s+expires|right\s+now\s+or/i;

/**
 * Heuristic scam/dark-pattern detector run on every seller message.
 * `agreedPrice` (when a price was just agreed) enables the bait-and-switch check:
 * a "total" higher than the agreed price means hidden costs.
 */
export function detectScam(text: string, agreedPrice: number | null = null): ScamResult {
  const signals: string[] = [];

  for (const m of text.matchAll(FEE_RE)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0);
    if (!NEGATION_RE.test(before)) {
      signals.push(`hidden fee ("${m[0].toLowerCase()}")`);
      break;
    }
  }
  if (OFF_PLATFORM_RE.test(text)) signals.push("asks for off-platform / untraceable payment");
  if (PRESSURE_RE.test(text)) signals.push("high-pressure urgency");

  if (agreedPrice !== null) {
    const totalMatch = /\b(total|comes\s+to|all\s+in|you\s+(?:pay|owe))\b[^$]{0,30}(\$\s?\d[\d,]*(?:\.\d{1,2})?)/i.exec(text);
    if (totalMatch?.[2]) {
      const [amount] = extractAmounts(totalMatch[2]);
      if (amount !== undefined && amount > agreedPrice + 0.5) {
        signals.push(`bait-and-switch (total ${amount} exceeds agreed ${agreedPrice})`);
      }
    }
  }

  // Urgency alone is only a warning sign; any other signal is disqualifying.
  const isScam = signals.some((s) => !s.startsWith("high-pressure")) || signals.length >= 2;
  return { isScam, signals };
}
