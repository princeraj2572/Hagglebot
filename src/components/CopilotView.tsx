"use client";
import { useState } from "react";
import type { CopilotDraft, CopilotTurn } from "@/lib/negotiation/copilot";
import { STYLE_INFO } from "@/lib/negotiation/strategy";
import { NEGOTIATION_STYLES, type NegotiationStyle } from "@/lib/negotiation/types";
import { api } from "./api";
import { usd } from "./format";
import { ghost, input, primary } from "./ui";

/**
 * Haggle copilot for a real listing (Facebook Marketplace, eBay, Craigslist...). Hagglebot drafts each message,
 * the person sends it themselves and pastes the seller's reply back. Nothing is sent anywhere automatically.
 */
export function CopilotView() {
  const [listing, setListing] = useState("");
  const [item, setItem] = useState("");
  const [asking, setAsking] = useState("");
  const [budget, setBudget] = useState("");
  const [style, setStyle] = useState<NegotiationStyle>("balanced");
  const [history, setHistory] = useState<CopilotTurn[]>([]);
  const [draft, setDraft] = useState<CopilotDraft | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fromListing = (text: string) => {
    setListing(text);
    // Fill the blanks from the pasted listing: the first line is usually the title, the first $ amount the price.
    if (!item.trim()) setItem(text.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 120) ?? "");
    const price = /\$\s?(\d[\d,]*)/.exec(text)?.[1];
    if (!asking.trim() && price) setAsking(price.replace(/,/g, ""));
  };

  const next = async (h: CopilotTurn[]) => {
    setBusy(true);
    try {
      const d = await api<CopilotDraft>("/api/copilot", "POST", { item, maxPrice: budget, style, askingPrice: asking, history: h });
      setHistory(h);
      setDraft(d);
      setReply("");
      setCopied(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const withDraft = (): CopilotTurn[] => (draft ? [...history, { from: "buyer", text: draft.text, price: draft.price }] : history);
  const done = draft !== null && draft.status !== "negotiating";

  return (
    <section aria-label="Copilot" className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="space-y-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Haggle copilot</h2>
          <p className="text-sm text-muted">For a real listing. Hagglebot drafts every message with the same guardrails; you send it yourself.</p>
        </div>
        <textarea className={input} rows={4} placeholder="Paste the listing (title, price, description)" value={listing} onChange={(e) => fromListing(e.target.value)} aria-label="Listing text" />
        <input className={input} placeholder="Item" value={item} onChange={(e) => setItem(e.target.value)} aria-label="Item" />
        <div className="grid grid-cols-2 gap-2">
          <input className={input} inputMode="numeric" placeholder="Asking price $" value={asking} onChange={(e) => setAsking(e.target.value.replace(/[^\d]/g, ""))} aria-label="Asking price in dollars" />
          <input className={input} inputMode="numeric" placeholder="Your budget $" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} aria-label="Your budget in dollars" />
        </div>
        <select className={input} value={style} onChange={(e) => setStyle(e.target.value as NegotiationStyle)} aria-label="Style">
          {NEGOTIATION_STYLES.map((s) => (
            <option key={s} value={s}>{STYLE_INFO[s].label}</option>
          ))}
        </select>
        <button className={`${primary} w-full`} disabled={busy || !item.trim() || !asking || !budget} onClick={() => void next([])}>
          {draft ? "Start over" : "Draft my first message"}
        </button>
        {error && <p role="alert" className="text-sm text-scam">{error}</p>}
      </div>

      <div className="min-w-0 space-y-4">
        {!draft && <p className="text-sm text-muted">Paste a listing and set your budget. Your budget never appears in a draft.</p>}
        {history.length > 0 && (
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className={`flex ${h.from === "buyer" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2 text-sm ${h.from === "buyer" ? "bg-ultra text-white" : "bg-mist"}`}>{h.text}</p>
              </li>
            ))}
          </ol>
        )}
        {draft && (
          <div className="space-y-2 rounded-xl border border-line p-4">
            <p className="text-[13px] font-medium text-muted">
              {!done ? "Send this to the seller" : draft.status === "deal" ? "Final message: close the deal" : "Final message: walk away"}
            </p>
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {draft.text}
              {draft.price !== null && <b className="num ml-2 rounded-md bg-tag px-1.5 py-0.5 text-sm">{usd(draft.price)}</b>}
            </p>
            {draft.notes.map((n, i) => (
              <p key={i} className={`border-l-2 pl-2 text-[13px] ${/^(Scam|Prompt)/.test(n) ? "border-scam text-scam" : "border-[#8B5CF6] text-[#5B3FC4]"}`}>{n}</p>
            ))}
            <button className={ghost} onClick={() => void navigator.clipboard?.writeText(draft.text).then(() => setCopied(true), () => setCopied(false))}>
              {copied ? "Copied" : "Copy message"}
            </button>
          </div>
        )}
        {draft && !done && (
          <div className="space-y-2">
            <textarea className={input} rows={3} placeholder="Paste the seller's reply" value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Seller's reply" />
            <button className={primary} disabled={busy || !reply.trim()} onClick={() => void next([...withDraft(), { from: "seller", text: reply.trim(), price: null }])}>
              Draft my next message
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
