"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { usd } from "./format";
import { ghost, input, primary } from "./ui";

interface View {
  item: string;
  sellerName: string;
  status: string;
  yourTurn: boolean;
  buyerOffer: number | null;
  messages: { from: "buyer" | "seller"; text: string; price: number | null; at: number; guard?: string }[];
}

const ENDED: Record<string, string> = {
  deal: "Deal closed. Hagglebot agreed a price inside its rules.",
  walked_away: "Hagglebot walked away.",
  awaiting_approval: "Hagglebot is asking its user to approve your price.",
  paused: "The negotiation is paused.",
};

/** The seller's side of a live "Beat the bot" negotiation, made for a phone. */
export function SellerChat({ threadId }: { threadId: string }) {
  const path = `/api/threads/${encodeURIComponent(threadId)}/seller`;
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        setView(await api<View>(path));
        setError((e) => (e === "Lost connection. Retrying…" ? null : e));
      } catch (e) {
        setError(e instanceof Error && /not found/i.test(e.message) ? e.message : "Lost connection. Retrying…");
      }
      if (!stop) timer = setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [path]);

  const count = view?.messages.length ?? 0;
  // Braces: newer Chrome's scrollIntoView returns a Promise, which React rejects as an effect cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const send = async (action: "counter" | "accept" | "refuse") => {
    setBusy(true);
    try {
      const msg = text.trim() || (action === "accept" ? `Deal at ${usd(view?.buyerOffer ?? null)}.` : action === "refuse" ? "No, that's too low." : "");
      await api(`/api/threads/${encodeURIComponent(threadId)}/reply`, "POST", { message: msg, action, ...(price.trim() ? { price: price.trim() } : {}) });
      setText("");
      setPrice("");
      setError(null);
      setView(await api<View>(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!view) return <main className="grid min-h-screen place-items-center p-4 text-sm text-muted">{error ?? "Loading…"}</main>;
  const ended = ENDED[view.status];

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pb-4 pt-5">
      <header className="mb-4">
        <p className="text-[13px] font-medium uppercase tracking-wide text-[#5B3FC4]">Beat the bot</p>
        <h1 className="text-xl font-semibold leading-tight">You're selling: {view.item}</h1>
        <p className="mt-1 text-sm text-muted">Hagglebot is an AI buyer agent. Get it to pay more, add a fee, or reveal its budget. Good luck.</p>
      </header>

      <ol className="flex-1 space-y-3">
        {view.messages.map((m, i) => {
          const you = m.from === "seller";
          return (
            <li key={i} className={`flex flex-col ${you ? "items-end" : "items-start"}`}>
              <span className="mb-0.5 text-[12px] text-muted">{you ? "You" : "Hagglebot (AI)"}</span>
              <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-xl px-3.5 py-2 text-[15px] leading-relaxed ${you ? "rounded-tr-md bg-mist" : "rounded-tl-md bg-ultra text-white"}`}>
                {m.text}
                {m.price !== null && <b className={`num ml-2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-sm ${you ? "bg-tag" : "bg-white/20"}`}>{usd(m.price)}</b>}
              </p>
              {m.guard && <p className="mt-1 max-w-[88%] border-l-2 border-[#8B5CF6] pl-2 text-[13px] text-[#5B3FC4]">Caught: {m.guard}</p>}
            </li>
          );
        })}
      </ol>
      <div ref={end} />

      {error && <p role="alert" className="mt-3 text-sm text-scam">{error}</p>}

      <div className="sticky bottom-0 mt-4 space-y-2 border-t border-line bg-paper pt-3">
        {ended ? (
          <p className="text-sm font-medium">{ended}</p>
        ) : !view.yourTurn ? (
          <p className="text-sm text-muted" role="status">Hagglebot is writing…</p>
        ) : (
          <>
            <textarea className={`${input} text-base`} rows={2} maxLength={500} placeholder="Your reply" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your reply" />
            <div className="flex gap-2">
              <input className={`${input} text-base`} inputMode="numeric" placeholder="Your price $" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} aria-label="Your price in dollars" />
              <button className={primary} disabled={busy} onClick={() => void send("counter")}>Counter</button>
            </div>
            <div className="flex gap-2">
              <button className={`${ghost} flex-1`} disabled={busy} onClick={() => void send("accept")}>Accept {usd(view.buyerOffer)}</button>
              <button className={`${ghost} flex-1`} disabled={busy} onClick={() => void send("refuse")}>Refuse</button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
