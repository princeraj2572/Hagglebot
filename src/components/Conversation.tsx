"use client";
import { useEffect, useRef } from "react";
import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { time, usd } from "./format";

function Shield() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5 2.5 3.5v4.2c0 3 2.3 5.4 5.5 6.8 3.2-1.4 5.5-3.8 5.5-6.8V3.5L8 1.5Z" />
      <path d="m5.6 8 1.7 1.7L10.5 6.4" />
    </svg>
  );
}

/**
 * The actual chat between Hagglebot and one seller. Hagglebot speaks on the right, the seller on the left.
 * A guardrail note sits directly under the message it explains, on the same side, so bubbles keep the full width.
 */
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
      className="lg:max-h-[32rem] lg:overflow-y-auto lg:pr-1"
    >
      <ol className="space-y-5">
        {t.messages.map((m, i) => {
          const buyer = m.from === "buyer";
          const scamNote = !!m.guard?.startsWith("Scam");
          return (
            <li
              key={i}
              className={`flex flex-col gap-1.5 ${i >= initial.current ? "motion-safe:animate-msg-in" : ""}`}
            >
              <div className={`flex ${buyer ? "justify-end" : "justify-start"}`}>
                <div className="min-w-0 max-w-[min(62ch,92%)]">
                  <div className={`flex items-center gap-1.5 text-[13px] ${buyer ? "justify-end text-ultra" : "text-muted"}`}>
                    <Avatar name={buyer ? "Hagglebot" : t.sellerName} size="sm" />
                    <span className="min-w-0 truncate font-medium" title={buyer ? "Hagglebot (AI)" : t.sellerName}>{buyer ? "Hagglebot (AI)" : t.sellerName}</span>
                    <span className="num shrink-0">{time(m.at)}</span>
                  </div>
                  <p
                    className={`mt-1 whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-relaxed ${
                      buyer ? "rounded-xl rounded-tr-md bg-ultra text-white" : "rounded-xl rounded-tl-md bg-mist"
                    }`}
                  >
                    {m.text}
                    {m.price !== null && (
                      <b className={`num ml-2 whitespace-nowrap rounded-md px-2 py-0.5 font-display text-sm ${buyer ? "bg-white/20" : "bg-tag"}`}>{usd(m.price)}</b>
                    )}
                  </p>
                </div>
              </div>
              {m.guard && (
                <p
                  className={`flex max-w-[min(62ch,92%)] items-start gap-1.5 border-l-2 py-0.5 pl-3 text-[13px] leading-snug ${buyer ? "self-end" : "self-start"} ${
                    scamNote ? "border-scam text-scam" : "border-[#8B5CF6] text-[#5B3FC4]"
                  }`}
                  data-testid="guardrail"
                >
                  <Shield />
                  <span><b className="font-semibold">Guardrail.</b> {m.guard}</span>
                </p>
              )}
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
