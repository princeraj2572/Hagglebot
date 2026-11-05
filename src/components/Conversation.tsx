"use client";
import { useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import { time, usd } from "./format";

/** The actual chat between Hagglebot and one seller: the latest exchange, with the full transcript one click away. */
export function Conversation({ t }: { t: Thread }) {
  const [expanded, setExpanded] = useState(false);
  const total = t.messages.length;
  if (total === 0) return null;
  const shown = expanded ? t.messages : t.messages.slice(-2);
  const offset = total - shown.length;

  return (
    <div className="mt-3">
      <ol className="space-y-3" aria-label={`Conversation with ${t.sellerName}`}>
        {shown.map((m, i) => {
          const buyer = m.from === "buyer";
          return (
            <li key={offset + i} className={buyer ? "pl-6" : "pr-6"}>
              <div className={`flex items-baseline justify-between gap-3 text-xs ${buyer ? "text-ultra" : "text-muted"}`}>
                <span className="font-medium">{buyer ? "Hagglebot (AI)" : t.sellerName}</span>
                <span className="num">{time(m.at)}</span>
              </div>
              <p className={`whitespace-pre-wrap break-words border-l-2 pl-3 font-serif text-[15px] leading-relaxed ${buyer ? "border-ultra" : "border-tag"}`}>
                {m.text}
                {m.price !== null && <b className="num ml-2 whitespace-nowrap font-display text-sm">{usd(m.price)}</b>}
              </p>
            </li>
          );
        })}
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
