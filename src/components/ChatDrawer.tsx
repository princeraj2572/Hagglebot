"use client";
import { useEffect, useRef } from "react";
import type { Thread } from "@/lib/negotiation/types";
import { REASON_LABEL, time, usd } from "./format";
import { StatusChip } from "./StatusChip";

/** Live chat transcript for one negotiation; updates as the dashboard polls. */
export function ChatDrawer({ thread, onClose }: { thread: Thread; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const count = thread.messages.length;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, thread.status]);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${thread.sellerName}`}
        className="flex h-full w-full max-w-md flex-col border-l border-navy-800 bg-navy-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-navy-800 p-4">
          <div>
            <h2 className="font-semibold text-slate-100">{thread.sellerName}</h2>
            <div className="mt-1"><StatusChip status={thread.status} /></div>
          </div>
          <button ref={closeBtn} onClick={onClose} aria-label="Close chat"
            className="rounded-md border border-navy-800 px-3 py-1.5 text-sm text-slate-300 hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Close
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" data-testid="chat-log">
          {thread.messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "buyer" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.from === "buyer" ? "rounded-br-sm bg-accent/15 text-slate-100" : "rounded-bl-sm bg-navy-800 text-slate-200"
              }`}>
                <div className="mb-0.5 flex items-center justify-between gap-3 text-[10px] uppercase tracking-wide text-slate-500">
                  <span>{m.from === "buyer" ? "Hagglebot (AI)" : thread.sellerName}</span>
                  <span>{time(m.at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                {m.price !== null && <p className="mt-1 text-xs text-accent">{usd(m.price)}</p>}
              </div>
            </div>
          ))}
          {thread.status === "negotiating" && (
            <p className="text-xs text-slate-500" aria-label="Negotiation in progress">
              <span className="animate-pulse">● ● ●</span>
            </p>
          )}
          {thread.status === "walked_away" && thread.reason && (
            <p className="text-center text-xs text-slate-400">{REASON_LABEL[thread.reason]}</p>
          )}
          {thread.status === "deal" && <p className="text-center text-xs text-accent">Deal at {usd(thread.dealPrice)}</p>}
          <div ref={end} />
        </div>
      </aside>
    </div>
  );
}
