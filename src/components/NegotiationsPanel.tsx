"use client";
import { useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { REASON_LABEL, usd } from "./format";
import { Avatar, tagline } from "./Avatar";
import { Conversation } from "./Conversation";
import { StatusChip } from "./StatusChip";

type Want = DashboardState["wants"][number];

const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const link = `${btn} text-ultra underline-offset-4 hover:underline`;

/** One shared price axis for every lane, so asks and offers are comparable at a glance. */
function axisFor(budget: number, threads: Thread[]) {
  const prices = threads.flatMap((t) => t.messages.map((m) => m.price).filter((p): p is number => p !== null));
  const lo = Math.max(0, Math.floor((Math.min(budget, ...prices) * 0.85) / 10) * 10);
  const hi = Math.ceil((Math.max(budget, ...prices) * 1.05) / 10) * 10;
  const pct = (p: number) => Math.min(100, Math.max(0, ((p - lo) / (hi - lo)) * 100));
  return { lo, hi, pct, pos: (p: number) => `${pct(p)}%` };
}

/** One plain sentence about the latest price move, so a viewer can follow without reading the chat. */
function lastMove(t: Thread): string | null {
  const priced = t.messages.filter((m) => m.price !== null);
  const m = priced.at(-1);
  if (!m) return null;
  const prev = priced.slice(0, -1).reverse().find((x) => x.from === m.from)?.price ?? null;
  const price = m.price as number;
  if (m.from === "seller") {
    const who = t.sellerName;
    return prev !== null && price < prev ? `${who} dropped the ask to ${usd(price)} (from ${usd(prev)})` : `${who} asks ${usd(price)}`;
  }
  return prev !== null && price > prev ? `Hagglebot raised the offer to ${usd(price)} (from ${usd(prev)})` : `Hagglebot offers ${usd(price)}`;
}

/** The thread as it looked after its first n messages, for the replay. */
function atStep(t: Thread, n: number): Thread {
  const ms = t.messages.slice(0, n);
  const lastOf = (from: "buyer" | "seller") => ms.filter((m) => m.from === from && m.price !== null).at(-1)?.price ?? null;
  const done = n >= t.messages.length;
  return {
    ...t,
    messages: ms,
    lastAsk: lastOf("seller"),
    lastOffer: lastOf("buyer"),
    status: done ? t.status : "negotiating",
    reason: done ? t.reason : null,
    detail: done ? t.detail : null,
    dealPrice: done ? t.dealPrice : null,
  };
}

export function NegotiationsPanel(props: {
  want: Want | undefined;
  threads: Thread[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { want, threads, onChanged, onError } = props;
  const [busy, setBusy] = useState(false);
  // Negotiations that finished before this page opened replay once, so the haggling is visible.
  const seen = useRef(new Set<string>());
  const [step, setStep] = useState(0);
  const [, rerender] = useState(0);
  const wantId = want?.id;
  const started = threads.length > 0;
  const live = threads.some((t) => t.status === "negotiating");
  const maxMsgs = Math.max(0, ...threads.map((t) => t.messages.length));
  const replaying = !!wantId && started && !live && !seen.current.has(wantId);

  useEffect(() => {
    if (!wantId) return;
    if (live) seen.current.add(wantId); // watched it happen live, no replay needed
    if (!replaying) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      seen.current.add(wantId);
      rerender((n) => n + 1);
      return;
    }
    let n = 0;
    setStep(0);
    const timer = setInterval(() => {
      n += 1;
      setStep(n);
      if (n >= maxMsgs) {
        clearInterval(timer);
        seen.current.add(wantId);
        rerender((k) => k + 1);
      }
    }, 500);
    return () => clearInterval(timer);
    // maxMsgs is read once per replay; it is stable for a finished negotiation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantId, replaying, live]);

  const skipReplay = () => {
    if (wantId) seen.current.add(wantId);
    rerender((n) => n + 1);
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!want) {
    return (
      <div className="max-w-md space-y-3">
        <h2 className="text-xl font-semibold">An AI agent that haggles for you</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Tell Hagglebot what you want and the most you will pay.</li>
          <li>It chats with every seller at once, never goes over your budget and walks away from scams.</li>
          <li>When a seller agrees to a price, you pay through PayPal.</li>
        </ol>
        <p className="text-sm text-muted">Add a want on the left, or load the demo scenario to watch it work.</p>
      </div>
    );
  }
  const axis = axisFor(want.maxPrice, threads);
  const shown = replaying ? threads.map((t) => atStep(t, step)) : threads;
  const best = threads.filter((t) => t.status === "deal" && t.dealPrice !== null).sort((a, b) => (a.dealPrice as number) - (b.dealPrice as number))[0];

  return (
    <section aria-label="Negotiations" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{want.item}</h2>
          <p className="text-sm text-muted">Budget {usd(want.maxPrice)}, never shown to sellers.</p>
        </div>
        <button
          className={`${btn} bg-ultra text-white hover:bg-[#2335b8]`}
          disabled={busy || live || want.status !== "open" || want.sellers.length === 0}
          onClick={() => run(() => api(`/api/wants/${want.id}/negotiate${started ? "?restart=1" : ""}`, "POST"))}
        >
          {started ? "Restart" : "Negotiate"}
        </button>
      </div>

      {!started && (
        <p className="text-sm text-muted">
          {want.sellers.length === 0 ? "Add at least one seller, then press Negotiate." : "Press Negotiate to start a chat with every seller in parallel."}
        </p>
      )}

      {started && (
        <>
          {!replaying && best && (
            <p className="num border-l-4 border-ultra bg-paper px-3 py-2 text-base">
              Best deal: <b>{best.sellerName}</b> at <b>{usd(best.dealPrice)}</b>, {usd(want.maxPrice - (best.dealPrice as number))} under budget.
            </p>
          )}
          {replaying && (
            <p className="text-sm text-muted">
              Replaying the negotiation. <button className="text-ultra underline-offset-4 hover:underline" onClick={skipReplay}>Skip</button>
            </p>
          )}
          <Roster threads={shown} />
          <Legend />
          <ul className="space-y-4">
            {shown.map((t) => (
              <Lane key={t.id} t={t} budget={want.maxPrice} axis={axis} busy={busy} replay={replaying} run={run} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Who Hagglebot is talking to right now, and what each conversation is waiting on. */
function Roster({ threads }: { threads: Thread[] }) {
  const live = threads.filter((t) => t.status === "negotiating").length;
  const deals = threads.filter((t) => t.status === "deal").length;
  const walked = threads.filter((t) => t.status === "walked_away").length;
  const line = (t: Thread): string => {
    const last = t.messages.at(-1);
    if (t.status === "negotiating") return last?.from === "buyer" ? `${t.sellerName} is replying…` : "Hagglebot is writing…";
    if (t.status === "deal") return `Deal at ${usd(t.dealPrice)}`;
    if (t.status === "paused") return "Paused";
    return t.reason === "scam_detected" ? "Scam detected" : "Walked away";
  };
  return (
    <div>
      <p className="num text-base">
        {live > 0 ? (
          <>
            <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-ultra align-middle motion-safe:animate-pulse" />
            Live: Hagglebot is talking to <b>{live}</b> of <b>{threads.length}</b> sellers right now
          </>
        ) : (
          <>
            Hagglebot talked to <b>{threads.length}</b> sellers: <b>{deals}</b> {deals === 1 ? "deal" : "deals"}, <b>{walked}</b> walked away
          </>
        )}
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {threads.map((t, i) => {
          const active = t.status === "negotiating";
          return (
            <li key={t.id}>
              <a
                href={`#lane-${t.id}`}
                className={`flex items-center gap-3 rounded-md border bg-paper px-3 py-2 ${active ? "border-ultra" : "border-line"}`}
              >
                <Avatar name={t.sellerName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    <span className="num mr-1.5 font-normal text-muted">{i + 1}/{threads.length}</span>
                    {t.sellerName}
                  </span>
                  <span className={`block truncate text-sm ${active ? "font-medium text-ultra" : "text-muted"}`}>{line(t)}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend() {
  return (
    <div className="space-y-1 text-sm text-muted">
      <p className="flex flex-wrap gap-x-5 gap-y-1">
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-tag" /> Their ask, on the upper line</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-ultra" /> Our offer, on the lower line</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-3.5 w-0.5 bg-ink" /> Budget</span>
      </p>
      <p>The grey bar is the gap between them. A deal happens when it closes.</p>
    </div>
  );
}

function Lane({ t, budget, axis, busy, replay, run }: {
  t: Thread;
  budget: number;
  axis: ReturnType<typeof axisFor>;
  busy: boolean;
  replay: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const scam = t.reason === "scam_detected";
  const asks = t.messages.filter((m) => m.from === "seller" && m.price !== null).map((m) => m.price as number);
  const offers = t.messages.filter((m) => m.from === "buyer" && m.price !== null).map((m) => m.price as number);
  const trail = (arr: number[]) => {
    if (arr.length < 2) return { left: "0%", width: "0%" };
    const a0 = axis.pct(arr[0] as number);
    const a1 = axis.pct(arr.at(-1) as number);
    return { left: `${Math.min(a0, a1)}%`, width: `${Math.abs(a0 - a1)}%` };
  };
  const ASK_Y = "26%";
  const OFFER_Y = "74%";
  const offerNow = t.status === "deal" && t.dealPrice !== null ? t.dealPrice : t.lastOffer;
  const gap = t.lastAsk !== null && offerNow !== null ? Math.abs(t.lastAsk - offerNow) : null;
  const open = t.status === "negotiating" || t.status === "paused";
  const fade = "transition-[left,width] duration-700 ease-out motion-reduce:transition-none";
  const dot = `absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-700 ease-out motion-reduce:transition-none`;
  const ring = t.status === "deal" ? "ring-2 ring-ink" : "";
  const move = lastMove(t);
  const saved = t.status === "deal" && t.dealPrice !== null ? budget - t.dealPrice : 0;
  const edge = scam ? "border-l-scam" : t.status === "deal" ? "border-l-ink" : t.status === "negotiating" ? "border-l-ultra" : t.status === "paused" ? "border-l-tag" : "border-l-muted";

  return (
    <li id={`lane-${t.id}`} className={`scroll-mt-4 rounded-md border border-l-4 border-line bg-paper p-4 ${edge}`} data-testid={`thread-${t.sellerName}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex items-center gap-3">
          <Avatar name={t.sellerName} size="lg" />
          <span>
            <span className="block text-lg font-semibold leading-tight">{t.sellerName}</span>
            <span className="block text-sm text-muted">{tagline(t.sellerName)}</span>
          </span>
        </span>
        <span className="flex items-center gap-3">
          {saved > 0 && (
            <span className="num relative bg-tag py-0.5 pl-5 pr-2.5 text-sm font-bold text-ink [clip-path:polygon(12px_0,100%_0,100%_100%,12px_100%,0_50%)] motion-safe:animate-tag-in">
              <i aria-hidden className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-chalk" />
              {usd(saved)} under budget
            </span>
          )}
          <StatusChip status={t.status} scam={scam} />
        </span>
      </div>

      <div
        className="relative mt-3 h-28"
        role="img"
        aria-label={`Ask ${usd(t.lastAsk)}, offer ${usd(t.lastOffer)}, budget ${usd(budget)}`}
      >
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: ASK_Y }} />
        <div className="absolute inset-x-0 h-px bg-line" style={{ top: OFFER_Y }} />
        <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: axis.pos(budget) }} />

        <div className={`absolute h-1 -translate-y-1/2 rounded-full bg-tag/70 ${fade}`} style={{ top: ASK_Y, ...trail(asks) }} />
        <div className={`absolute h-1 -translate-y-1/2 rounded-full bg-ultra/60 ${fade}`} style={{ top: OFFER_Y, ...trail(offers) }} />
        {asks.map((p, i) => (
          <i key={`a${i}`} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tag" style={{ top: ASK_Y, left: axis.pos(p) }} />
        ))}
        {offers.map((p, i) => (
          <i key={`o${i}`} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ultra" style={{ top: OFFER_Y, left: axis.pos(p) }} />
        ))}

        {open && gap !== null && gap > 0 && (
          <div className={`absolute h-2 -translate-y-1/2 rounded-full bg-ink/15 ${fade}`}
            style={{ top: "50%", left: `${Math.min(axis.pct(t.lastAsk as number), axis.pct(t.lastOffer as number))}%`, width: `${Math.abs(axis.pct(t.lastAsk as number) - axis.pct(t.lastOffer as number))}%` }}>
            <span className="num absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-paper px-1 text-xs font-medium">{usd(gap)} apart</span>
          </div>
        )}

        {t.lastAsk !== null && (
          <span className={`${dot} bg-tag text-tag ${ring}`} style={{ top: ASK_Y, left: axis.pos(t.lastAsk) }}>
            <i key={t.lastAsk} aria-hidden className="absolute inset-0 rounded-full ring-2 ring-current motion-safe:animate-ping-once motion-reduce:hidden" />
            <b className="num absolute bottom-full left-1/2 mb-1 -translate-x-1/2 bg-paper px-0.5 text-xs font-semibold text-ink">{usd(t.lastAsk)}</b>
          </span>
        )}
        {offerNow !== null && (
          <span className={`${dot} bg-ultra text-ultra ${ring}`} style={{ top: OFFER_Y, left: axis.pos(offerNow) }}>
            <i key={offerNow} aria-hidden className="absolute inset-0 rounded-full ring-2 ring-current motion-safe:animate-ping-once motion-reduce:hidden" />
            <b className="num absolute left-1/2 top-full mt-1 -translate-x-1/2 bg-paper px-0.5 text-xs font-semibold text-ink">{usd(offerNow)}</b>
          </span>
        )}
        {scam && <span aria-hidden className="absolute right-0 top-1/2 -translate-y-1/2 text-xl font-bold text-scam">×</span>}
      </div>
      <div className="num relative flex justify-between text-xs text-muted" aria-hidden>
        <span>{usd(axis.lo)}</span>
        <span className="absolute -translate-x-1/2 font-medium text-ink" style={{ left: axis.pos(budget) }}>{usd(budget)}</span>
        <span>{usd(axis.hi)}</span>
      </div>

      <p className="num mt-2 text-sm">
        {t.status === "deal" ? (
          <span className="font-semibold">Deal at {usd(t.dealPrice)}</span>
        ) : (
          <>{open && move ? move : <>Ask <b>{usd(t.lastAsk)}</b>, offer <b>{usd(t.lastOffer)}</b></>}, {t.messages.length} messages</>
        )}
        {t.status === "walked_away" && t.reason && (
          <span className={scam ? "text-scam" : "text-muted"}> · {REASON_LABEL[t.reason]}{t.detail ? ` (${t.detail})` : ""}</span>
        )}
        {t.status === "paused" && t.detail && <span className="text-muted"> · {t.detail}</span>}
      </p>
      <Conversation t={t} />

      <div className="-ml-3 mt-1 flex gap-1">
        {t.status === "negotiating" && !replay && (
          <button className={`${btn} text-ink hover:text-scam`} disabled={busy} onClick={() => run(() => api(`/api/threads/${t.id}/pause`, "POST"))}>
            Pause
          </button>
        )}
        {t.status === "paused" && (
          <button className={link} disabled={busy} onClick={() => run(() => api(`/api/threads/${t.id}/resume`, "POST"))}>
            Resume
          </button>
        )}
      </div>
    </li>
  );
}
