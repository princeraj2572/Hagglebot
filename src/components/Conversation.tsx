"use client";
import { useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { time, usd } from "./format";

/** The actual chat between Hagglebot and one seller: the latest exchange, with the full transcript one click away. */
export function Conversation({ t }: { t: Thread }) {
  const [expanded, setExpanded] = useState(false);
  const total = t.messages.length;
  const last = t.messages.at(-1);
  // Whoever has not spoken last is the one writing now.
  const writing = t.status === "negotiating" ? (last?.from === "seller" || !last ? "Hagglebot" : t.sellerName) : null;
  if (total === 0 && !writing) return null;
  const shown = expanded ? t.messages : t.messages.slice(-2);
  const offset = total - shown.length;

  return (
    <div className="mt-3">
      <ol className="space-y-3" aria-label={`Conversation with ${t.sellerName}`}>
        {shown.map((m, i) => {
          const buyer = m.from === "buyer";
          const who = buyer ? "Hagglebot" : t.sellerName;
          return (
            <li key={offset + i} className={buyer ? "pl-6" : "pr-6"}>
              <div className={`flex items-center justify-between gap-3 text-xs ${buyer ? "text-ultra" : "text-muted"}`}>
                <span className="flex items-center gap-1.5 font-medium">
                  <Avatar name={who} size="sm" />
                  {buyer ? "Hagglebot (AI)" : t.sellerName}
                </span>
                <span className="num">{time(m.at)}</span>
              </div>
              <p className={`mt-1 whitespace-pre-wrap break-words border-l-2 pl-3 font-serif text-[15px] leading-relaxed ${buyer ? "border-ultra" : "border-tag"}`}>
                {m.text}
                {m.price !== null && <b className="num ml-2 whitespace-nowrap font-display text-sm">{usd(m.price)}</b>}
              </p>
            </li>
          );
        })}
        {writing && (
          <li role="status" className={`flex items-center gap-2 text-sm font-medium ${writing === "Hagglebot" ? "pl-6 text-ultra" : "pr-6 text-muted"}`}>
            <Avatar name={writing} size="sm" />
            {writing === "Hagglebot" ? "Hagglebot is writing" : `${writing} is replying`}
            <span aria-hidden className="inline-flex gap-0.5">
              {[0, 1, 2].map((d) => (
                <i key={d} className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" style={{ animationDelay: `${d * 250}ms` }} />
              ))}
            </span>
          </li>
        )}
      </ol>
      {total > 2 && (
        <button
          className="mt-2 rounded-md py-1 text-sm font-medium text-ultra underline-offset-4 hover:underline"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show only the latest messages" : `Show the full conversation (${total} messages)`}
        </button>
      )}
    </div>
  );
}
