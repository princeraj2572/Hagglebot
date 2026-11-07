import { REASON_TEXT } from "./reasons";
import type { Thread, Want } from "./types";

const iso = (at: number): string => new Date(at).toISOString().replace("T", " ").slice(0, 19) + " UTC";

/** A readable audit trail of one negotiation: every message, and every guardrail note that shaped it. */
export function transcriptMarkdown(t: Thread, want: Want): string {
  const outcome =
    t.status === "deal" && t.dealPrice !== null
      ? `Deal at $${t.dealPrice}`
      : t.status === "walked_away" && t.reason
        ? REASON_TEXT[t.reason]
        : t.status === "awaiting_approval"
          ? `Waiting for your approval of $${t.lastAsk ?? "?"}`
          : t.status === "paused"
            ? "Paused"
            : "In progress";
  const notes = t.messages.filter((m) => m.guard).length;
  const lines = [
    `# Negotiation transcript: ${t.sellerName}`,
    "",
    `- Item: ${want.item}`,
    `- Budget: $${want.maxPrice} (never shown to the seller)`,
    `- Seller: ${t.sellerName}`,
    `- Outcome: ${outcome}`,
    `- Messages: ${t.messages.length}, guardrail notes: ${notes}`,
    "",
    "Hagglebot is an AI buyer agent. Guardrail notes are added by the code and are never sent to the seller.",
    "",
    "## Conversation",
    "",
  ];
  for (const m of t.messages) {
    lines.push(`**${m.from === "buyer" ? "Hagglebot (AI)" : t.sellerName}** · ${iso(m.at)}${m.price !== null ? ` · price $${m.price}` : ""}`);
    lines.push("", m.text.replace(/\r?\n/g, " "), "");
    if (m.guard) lines.push(`> Guardrail: ${m.guard}`, "");
  }
  return lines.join("\n");
}

/** A safe file name for the download. */
export const transcriptFileName = (t: Thread): string => `hagglebot-${t.sellerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "seller"}.md`;
