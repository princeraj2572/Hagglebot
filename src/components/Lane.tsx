"use client";
import { useEffect, useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import { REASON_LABEL, usd } from "./format";

/** One shared price axis for every seller, so asks and offers are comparable at a glance. */
export function axisFor(budget: number, threads: Thread[]) {
  const prices = threads.flatMap((t) => t.messages.map((m) => m.price).filter((p): p is number => p !== null && Number.isFinite(p)));
  const lo = Math.max(0, Math.floor((Math.min(budget, ...prices) * 0.85) / 10) * 10);
  let hi = Math.ceil((Math.max(budget, ...prices) * 1.05) / 10) * 10;
  if (!(hi > lo)) hi = lo + 10; // all prices equal: keep a real axis instead of dividing by zero
  const span = hi - lo;
  const pct = (p: number) => (Number.isFinite(p) ? Math.min(100, Math.max(0, ((p - lo) / span) * 100)) : 0);
  return { lo, hi, pct, pos: (p: number) => `${pct(p)}%` };
}
export type Axis = ReturnType<typeof axisFor>;

/** One plain sentence about the latest price move, so a viewer can follow without reading the chat. */
export function lastMove(t: Thread): string | null {
  const priced = t.messages.filter((m) => m.price !== null);
  const m = priced.at(-1);
  if (!m) return null;
  const prev = priced.slice(0, -1).reverse().find((x) => x.from === m.from)?.price ?? null;
  const price = m.price as number;
  if (m.from === "seller") {
    return prev !== null && price < prev ? `${t.sellerName} dropped the ask to ${usd(price)} (from ${usd(prev)})` : `${t.sellerName} asks ${usd(price)}`;
  }
  return prev !== null && price > prev ? `Hagglebot raised the offer to ${usd(price)} (from ${usd(prev)})` : `Hagglebot offers ${usd(price)}`;
}

const EASE = "duration-[450ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";
const ASK_Y = "26%";
const OFFER_Y = "74%";

/** The price lane for one seller: where their ask and our offer are, and how far apart. */
export function Lane({ t, budget, axis }: { t: Thread; budget: number; axis: Axis }) {
  // The "price changed" ring only plays for changes seen after the lane is on screen, never on first paint.
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);

  const scam = t.reason === "scam_detected";
  const asks = t.messages.filter((m) => m.from === "seller" && m.price !== null).map((m) => m.price as number);
  const offers = t.messages.filter((m) => m.from === "buyer" && m.price !== null).map((m) => m.price as number);
  const trail = (arr: number[]) => {
    if (arr.length < 2) return { left: "0%", width: "0%" };
    const a0 = axis.pct(arr[0] as number);
    const a1 = axis.pct(arr.at(-1) as number);
    return { left: `${Math.min(a0, a1)}%`, width: `${Math.abs(a0 - a1)}%` };
  };
  const offerNow = t.status === "deal" && t.dealPrice !== null ? t.dealPrice : t.lastOffer;
  const gap = t.lastAsk !== null && offerNow !== null ? Math.abs(t.lastAsk - offerNow) : null;
  const open = t.status === "negotiating" || t.status === "paused";
  const showGap = (open || t.status === "deal") && gap !== null;
  const gapLeft = gap === null ? 0 : Math.min(axis.pct(t.lastAsk as number), axis.pct(offerNow as number));
  const gapWidth = gap === null ? 0 : Math.abs(axis.pct(t.lastAsk as number) - axis.pct(offerNow as number));
  const slide = `transition-[left,width] ${EASE}`;
  const dot = `absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] ${EASE}`;
  const ring = t.status === "deal" ? "ring-2 ring-ink" : "";
  const move = lastMove(t);

  return (
    <div>
      <div
        className="relative mx-7 h-28"
        role="img"
        aria-label={`Ask ${usd(t.lastAsk)}, offer ${usd(offerNow)}, budget ${usd(budget)}`}
      >
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: ASK_Y }} />
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: OFFER_Y }} />
        <div className={`absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink transition-[left] ${EASE}`} style={{ left: axis.pos(budget) }} />

        <div className={`absolute h-1 -translate-y-1/2 rounded-full bg-tag/70 ${slide}`} style={{ top: ASK_Y, ...trail(asks) }} />
        <div className={`absolute h-1 -translate-y-1/2 rounded-full bg-ultra/60 ${slide}`} style={{ top: OFFER_Y, ...trail(offers) }} />
        {asks.slice(0, -1).map((p, i) => (
          <i key={`a${i}`} className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tag transition-[left] ${EASE}`} style={{ top: ASK_Y, left: axis.pos(p) }} />
        ))}
        {offers.slice(0, -1).map((p, i) => (
          <i key={`o${i}`} className={`absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ultra transition-[left] ${EASE}`} style={{ top: OFFER_Y, left: axis.pos(p) }} />
        ))}

        {showGap && (
          <div className={`absolute h-2 -translate-y-1/2 rounded-full bg-ink/15 ${slide}`} style={{ top: "50%", left: `${gapLeft}%`, width: `${gapWidth}%` }}>
            {gap > 0 && (
              <span className="num absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-paper px-1 text-[13px] font-medium">{usd(gap)} apart</span>
            )}
          </div>
        )}

        {t.lastAsk !== null && (
          <span className={`${dot} bg-tag text-tag ${ring}`} style={{ top: ASK_Y, left: axis.pos(t.lastAsk) }}>
            {armed && <i key={t.lastAsk} aria-hidden className="absolute inset-0 rounded-full ring-2 ring-current motion-safe:animate-ping-once motion-reduce:hidden" />}
            <b className="num absolute bottom-full left-1/2 mb-1 -translate-x-1/2 bg-paper px-0.5 text-[13px] font-semibold text-ink">{usd(t.lastAsk)}</b>
          </span>
        )}
        {offerNow !== null && (
          <span className={`${dot} bg-ultra text-ultra ${ring}`} style={{ top: OFFER_Y, left: axis.pos(offerNow) }}>
            {armed && <i key={offerNow} aria-hidden className="absolute inset-0 rounded-full ring-2 ring-current motion-safe:animate-ping-once motion-reduce:hidden" />}
            <b className="num absolute left-1/2 top-full mt-1 -translate-x-1/2 bg-paper px-0.5 text-[13px] font-semibold text-ink">{usd(offerNow)}</b>
          </span>
        )}
        {scam && <span aria-hidden className="absolute right-0 top-1/2 -translate-y-1/2 text-xl font-bold text-scam">×</span>}
      </div>

      {/* mx-7 keeps price labels near either end inside the card; an end label hides when the budget label would sit on it */}
      <div className="num relative mx-7 mt-1 flex justify-between text-[13px] text-muted" aria-hidden>
        <span className={axis.pct(budget) < 18 ? "invisible" : ""}>{usd(axis.lo)}</span>
        <span className={`absolute -translate-x-1/2 whitespace-nowrap font-medium text-ink transition-[left] ${EASE}`} style={{ left: axis.pos(budget) }}>Budget {usd(budget)}</span>
        <span className={axis.pct(budget) > 82 ? "invisible" : ""}>{usd(axis.hi)}</span>
      </div>

      <p className="num mt-2 text-sm">
        {t.status === "deal" ? (
          <span className="font-semibold">Deal at {usd(t.dealPrice)}</span>
        ) : (
          <>{open && move ? move : <>Ask <b>{usd(t.lastAsk)}</b>, offer <b>{usd(offerNow)}</b></>}, {t.messages.length} messages</>
        )}
        {t.status === "walked_away" && t.reason && (
          <span className={scam ? "font-semibold text-scam" : "text-muted"}> · {REASON_LABEL[t.reason]}{t.detail ? ` (${t.detail})` : ""}</span>
        )}
        {t.status === "paused" && t.detail && <span className="text-muted"> · {t.detail}</span>}
      </p>

      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-tag" /> Their ask</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-ultra" /> Our offer</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-0.5 bg-ink" /> Budget</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-4 rounded-full bg-ink/15" /> Gap</span>
      </p>
    </div>
  );
}
