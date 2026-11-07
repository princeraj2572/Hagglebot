"use client";
import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { usd } from "./format";
import type { Axis } from "./Lane";

const EASE = "duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

function outcome(t: Thread): { text: string; tone: string } {
  if (t.status === "deal" && t.dealPrice !== null) return { text: `Deal ${usd(t.dealPrice)}`, tone: "font-semibold text-white" };
  if (t.reason === "scam_detected") return { text: "Scam", tone: "font-semibold text-[#FF8A98]" };
  if (t.status === "walked_away") return { text: "Walked away", tone: "text-white/55" };
  if (t.status === "awaiting_approval") return { text: "Needs you", tone: "font-semibold text-tag" };
  if (t.status === "paused") return { text: "Paused", tone: "text-white/55" };
  return { text: "Haggling…", tone: "text-white/80" };
}

/**
 * Every seller on one shared price axis: where their ask and our offer stand against your budget.
 * Same scale as the price lane in each chat, so the whole negotiation reads at a glance.
 */
export function PriceLadder({ threads, budget, axis, onOpen }: { threads: Thread[]; budget: number; axis: Axis; onOpen: (id: string) => void }) {
  if (threads.length === 0) return null;
  const cols = "grid-cols-[7rem_minmax(0,1fr)_6.5rem] sm:grid-cols-[9rem_minmax(0,1fr)_7rem]";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h3 className="text-sm font-semibold text-white/85">Where every seller stands</h3>
        <p className="flex items-center gap-4 text-[13px] text-white/60" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-tag" />Their ask</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#7C8CFF]" />Our offer</span>
        </p>
      </div>

      <ul className="mt-2 space-y-0.5" aria-label="Sellers on one price scale">
        {threads.map((t) => {
          const settled = t.status === "deal" && t.dealPrice !== null;
          const ask = settled ? t.dealPrice : t.lastAsk;
          const offer = settled ? t.dealPrice : t.lastOffer;
          const o = outcome(t);
          const left = ask !== null && offer !== null ? Math.min(axis.pct(ask), axis.pct(offer)) : 0;
          const width = ask !== null && offer !== null ? Math.abs(axis.pct(ask) - axis.pct(offer)) : 0;
          return (
            <li key={t.id}>
              <button
                onClick={() => onOpen(t.id)}
                className={`grid w-full ${cols} items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-150 [@media(hover:hover)]:hover:bg-white/[0.07]`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex shrink-0 rounded-full bg-white"><Avatar name={t.sellerName} size="sm" /></span>
                  <span className="truncate text-sm text-white/90" title={t.sellerName}>{t.sellerName}</span>
                </span>
                <span className="relative block h-6" aria-hidden>
                  <i className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
                  <i className="absolute inset-y-0 w-px bg-white/70" style={{ left: axis.pos(budget) }} />
                  {width > 0 && (
                    <i className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20 transition-[left,width] ${EASE}`} style={{ left: `${left}%`, width: `${width}%` }} />
                  )}
                  {ask !== null && (
                    <i className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tag transition-[left] ${EASE}`} style={{ left: axis.pos(ask) }} />
                  )}
                  {offer !== null && (
                    <i
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7C8CFF] transition-[left] ${EASE} ${settled ? "ring-2 ring-white" : ""}`}
                      style={{ left: axis.pos(offer) }}
                    />
                  )}
                </span>
                <span className={`num truncate text-right text-sm ${o.tone}`}>{o.text}</span>
                <span className="sr-only">
                  {t.sellerName}: ask {usd(ask)}, offer {usd(offer)}. Open the conversation.
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={`mt-1 grid ${cols} gap-3 px-2`} aria-hidden>
        <span />
        <span className="relative block h-4 text-[12px] text-white/50">
          {axis.pct(budget) > 14 && <span className="num absolute left-0">{usd(axis.lo)}</span>}
          <span className="num absolute -translate-x-1/2 whitespace-nowrap text-white/80" style={{ left: axis.pos(budget) }}>Budget {usd(budget)}</span>
          {axis.pct(budget) < 86 && <span className="num absolute right-0">{usd(axis.hi)}</span>}
        </span>
        <span />
      </div>
    </div>
  );
}
