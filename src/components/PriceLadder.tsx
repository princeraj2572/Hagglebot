"use client";
import type { Thread } from "@/lib/negotiation/types";
import { Avatar } from "./Avatar";
import { usd } from "./format";
import type { Axis } from "./Lane";

const EASE = "duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";

function outcome(t: Thread): { text: string; tone: string } {
  if (t.status === "deal" && t.dealPrice !== null) return { text: `Deal ${usd(t.dealPrice)}`, tone: "font-semibold text-ink" };
  if (t.reason === "scam_detected") return { text: "Scam", tone: "font-semibold text-[#FF8A98]" };
  if (t.status === "walked_away") return { text: "Walked away", tone: "text-muted" };
  if (t.status === "awaiting_approval") return { text: "Needs you", tone: "font-semibold text-ultra" };
  if (t.status === "paused") return { text: "Paused", tone: "text-muted" };
  return { text: "Haggling…", tone: "text-ink" };
}

/**
 * Every seller on one shared price axis: where their ask and our offer stand against your budget.
 * Same scale as the price lane in each chat, so the whole negotiation reads at a glance.
 */
export function PriceLadder({ threads, budget, axis, onOpen }: { threads: Thread[]; budget: number; axis: Axis; onOpen: (id: string) => void }) {
  if (threads.length === 0) return null;
  // Phones: name and result on one line, the price scale full width underneath. From sm up: name | scale | result.
  const cols = "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[9rem_minmax(0,1fr)_7rem]";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h3 className="text-sm font-semibold text-ink">Where every seller stands</h3>
        <p className="flex items-center gap-4 text-[13px] text-muted" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-tag" />Their ask</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ultra" />Our offer</span>
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
                className={`grid w-full ${cols} items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 sm:py-1.5 text-left transition-colors duration-150 [@media(hover:hover)]:hover:bg-mist`}
              >
                <span className="order-1 flex min-w-0 items-center gap-2 sm:order-none">
                  <span className="inline-flex shrink-0 rounded-full bg-paper"><Avatar name={t.sellerName} size="sm" /></span>
                  <span className="truncate text-sm text-ink" title={t.sellerName}>{t.sellerName}</span>
                </span>
                <span className="relative order-3 col-span-2 block h-6 sm:order-none sm:col-span-1" aria-hidden>
                  <i className="absolute inset-x-0 top-1/2 h-px bg-line" />
                  <i className="absolute inset-y-0 w-px bg-ink/70" style={{ left: axis.pos(budget) }} />
                  {width > 0 && (
                    <i className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ultra/20 transition-[left,width] ${EASE}`} style={{ left: `${left}%`, width: `${width}%` }} />
                  )}
                  {ask !== null && (
                    <i className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tag transition-[left] ${EASE}`} style={{ left: axis.pos(ask) }} />
                  )}
                  {offer !== null && (
                    <i
                      className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ultra transition-[left] ${EASE} ${settled ? "ring-2 ring-ink/10" : ""}`}
                      style={{ left: axis.pos(offer) }}
                    />
                  )}
                </span>
                <span className={`num order-2 truncate text-right text-sm sm:order-none ${o.tone}`}>{o.text}</span>
                <span className="sr-only">
                  {t.sellerName}: ask {usd(ask)}, offer {usd(offer)}. Open the conversation.
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 grid grid-cols-1 gap-3 px-2 sm:grid-cols-[9rem_minmax(0,1fr)_7rem]" aria-hidden>
        <span className="hidden sm:block" />
        <span className="relative block h-4 text-[12px] text-muted">
          {axis.pct(budget) > 14 && <span className="num absolute left-0 hidden sm:block">{usd(axis.lo)}</span>}
          <span className="num absolute -translate-x-1/2 whitespace-nowrap text-ink" style={{ left: axis.pos(budget) }}>Budget<span className="hidden sm:inline"> {usd(budget)}</span></span>
          {axis.pct(budget) < 86 && <span className="num absolute right-0 hidden sm:block">{usd(axis.hi)}</span>}
        </span>
        <span className="hidden sm:block" />
      </div>
    </div>
  );
}
