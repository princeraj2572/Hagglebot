"use client";
import { useEffect, useRef } from "react";
import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { time, usd } from "./format";

/** The actual chat between Hagglebot and one seller. Hagglebot speaks on the right, the seller on the left. */
export function Conversation({ t }: { t: Thread }) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // follow new messages unless the reader scrolled up
  const initial = useRef(t.messages.length); // messages already on screen when this chat opened do not animate in
  const total = t.messages.length;
  const last = t.messages.at(-1);
  // Whoever has not spoken last is the one writing now.
  const writing = t.status === "negotiating" ? (last?.from === "seller" || !last ? "Hagglebot" : t.sellerName) : null;

  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [total, writing]);

  if (total === 0 && !writing) return <p className="text-sm text-muted">No messages yet.</p>;

  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      tabIndex={0}
      role="region"
      aria-label={`Conversation with ${t.sellerName}`}
      className="max-h-[30rem] overflow-y-auto pr-1"
    >
      <ol className="space-y-4">
        {t.messages.map((m, i) => {
          const buyer = m.from === "buyer";
          return (
            <li key={i} className={`flex ${buyer ? "justify-end" : "justify-start"} ${i >= initial.current ? "motion-safe:animate-msg-in" : ""}`}>
              <div className="min-w-0 max-w-[min(62ch,92%)]">
                <div className={`flex items-center gap-1.5 text-[13px] ${buyer ? "justify-end text-ultra" : "text-muted"}`}>
                  <Avatar name={buyer ? "Hagglebot" : t.sellerName} size="sm" />
                  <span className="min-w-0 truncate font-medium" title={buyer ? "Hagglebot (AI)" : t.sellerName}>{buyer ? "Hagglebot (AI)" : t.sellerName}</span>
                  <span className="num shrink-0">{time(m.at)}</span>
                </div>
                <p
                  className={`mt-1 whitespace-pre-wrap break-words rounded-md border-l-2 px-3 py-2 font-serif text-[15px] leading-relaxed ${
                    buyer ? "border-ultra bg-ultra/5" : "border-tag bg-tag/10"
                  }`}
                >
                  {m.text}
                  {m.price !== null && (
                    <b className={`num ml-2 whitespace-nowrap rounded px-1.5 py-0.5 font-display text-sm ${buyer ? "bg-ultra/10 text-ultra" : "bg-tag/30"}`}>{usd(m.price)}</b>
                  )}
                </p>
              </div>
            </li>
          );
        })}
        {writing && (
          <li role="status" className={`flex ${writing === "Hagglebot" ? "justify-end text-ultra" : "justify-start text-muted"}`}>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Avatar name={writing} size="sm" />
              {writing === "Hagglebot" ? "Hagglebot is writing" : `${writing} is replying`}
              <span aria-hidden className="inline-flex gap-0.5">
                {[0, 150, 300].map((d) => (
                  <i key={d} className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-typing" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}
