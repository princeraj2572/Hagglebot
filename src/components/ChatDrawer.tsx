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
  const scam = thread.reason === "scam_detected";

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
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/50" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${thread.sellerName}`}
        className="flex h-full w-full max-w-md flex-col border-l border-line bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line p-4">
          <div>
            <h2 className="text-lg font-semibold">{thread.sellerName}</h2>
            <StatusChip status={thread.status} scam={scam} />
          </div>
          <button
            ref={closeBtn}
            onClick={onClose}
            aria-label="Close chat"
            className="rounded-md border border-line px-3 py-1.5 text-sm hover:border-ink"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" data-testid="chat-log">
          {thread.messages.map((m, i) => (
            <div key={i} className={m.from === "buyer" ? "pl-8" : "pr-8"}>
              <div className={`flex items-baseline justify-between gap-3 text-xs ${m.from === "buyer" ? "text-ultra" : "text-muted"}`}>
                <span className="font-medium">{m.from === "buyer" ? "Hagglebot (AI)" : thread.sellerName}</span>
                <span className="num">{time(m.at)}</span>
              </div>
              <p className={`whitespace-pre-wrap break-words border-l-2 pl-3 font-serif text-base leading-relaxed ${
                m.from === "buyer" ? "border-ultra" : "border-tag"
              }`}>
                {m.text}
              </p>
              {m.price !== null && <p className="num mt-0.5 pl-3 text-sm font-semibold">{usd(m.price)}</p>}
            </div>
          ))}
          {thread.status === "negotiating" && (
            <p className="text-sm text-muted motion-safe:animate-pulse">Waiting for the next message…</p>
          )}
          {thread.status === "walked_away" && thread.reason && (
            <p className={`text-sm font-medium ${scam ? "text-scam" : "text-muted"}`}>{REASON_LABEL[thread.reason]}</p>
          )}
          {thread.status === "deal" && <p className="text-sm font-semibold">Deal at {usd(thread.dealPrice)}</p>}
          <div ref={end} />
        </div>
      </aside>
    </div>
  );
}
