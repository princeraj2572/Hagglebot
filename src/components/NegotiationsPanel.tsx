"use client";
import { useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import type { Deal, WantRecord } from "@/server/repo";
import type { DashboardState } from "@/server/state";
import { DealsPanel } from "./DealsPanel";
import { Detail } from "./Detail";
import { usd } from "./format";
import { Inbox } from "./Inbox";
import { axisFor } from "./Lane";
import { primary } from "./ui";
import { openingOffer, STYLE_INFO } from "@/lib/negotiation/strategy";

type Want = DashboardState["wants"][number];
type View = "conversations" | "deals";

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

function Stat({ label, value, note }: { label: string; value: string; note: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-paper p-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="num mt-0.5 truncate text-2xl font-bold leading-tight">{value}</dd>
      <dd className="mt-0.5 text-[13px] text-muted">{note}</dd>
    </div>
  );
}

export function NegotiationsPanel(props: {
  want: Want | undefined;
  threads: Thread[];
  deals: Deal[];
  wants: WantRecord[];
  paypalClientId: string | null;
  buyerEmail: string | null;
  busy: boolean;
  canNegotiate: boolean;
  onNegotiate: () => void;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { want, threads, deals, wants, paypalClientId, buyerEmail, busy, canNegotiate, onNegotiate, run, onChanged, onError } = props;

  // Negotiations that finished before this page opened replay once, so the haggling is visible.
  const seen = useRef(new Set<string>());
  const [step, setStep] = useState(0);
  const [, rerender] = useState(0);
  const [view, setView] = useState<View>("conversations");
  const [pick, setPick] = useState<{ wantId: string; id: string } | null>(null);
  const [showDetail, setShowDetail] = useState(false); // below xl the inbox and the detail are two screens
  const [read, setRead] = useState<Record<string, number>>({});
  const wantId = want?.id;
  const started = threads.length > 0;
  const live = threads.some((t) => t.status === "negotiating");
  const maxMsgs = Math.max(0, ...threads.map((t) => t.messages.length));
  const replaying = !!wantId && started && !live && !seen.current.has(wantId);
  const shown = replaying ? threads.map((t) => atStep(t, step)) : threads;
  const selected =
    (pick && pick.wantId === wantId ? shown.find((t) => t.id === pick.id) : undefined) ?? shown[0];

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

  // A thread you have not opened shows a dot when new messages arrive; what was there on first sight counts as read.
  useEffect(() => {
    setRead((prev) => {
      let next = prev;
      for (const t of shown) {
        if (prev[t.id] === undefined) {
          if (next === prev) next = { ...prev };
          next[t.id] = t.messages.length;
        }
      }
      return next;
    });
  }, [shown]);
  const selectedId = selected?.id;
  const selectedCount = selected?.messages.length ?? 0;
  useEffect(() => {
    if (!selectedId) return;
    setRead((prev) => (prev[selectedId] === selectedCount ? prev : { ...prev, [selectedId]: selectedCount }));
  }, [selectedId, selectedCount]);

  const skipReplay = () => {
    if (wantId) seen.current.add(wantId);
    rerender((n) => n + 1);
  };

  if (!want) {
    return (
      <div className="max-w-xl space-y-4 rounded-md border border-line bg-paper p-6">
        <h2 className="text-2xl font-bold tracking-tight">An AI agent that haggles for you</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Tell Hagglebot what you want and the most you will pay.</li>
          <li>It chats with every seller at once, never goes over your budget and walks away from scams.</li>
          <li>When a seller agrees to a price, you pay through PayPal.</li>
        </ol>
        <p className="text-sm text-muted">Add a want in the sidebar, or load the demo scenario to watch it work.</p>
      </div>
    );
  }

  const axis = axisFor(want.maxPrice, threads);
  const dealThreads = shown.filter((t) => t.status === "deal" && t.dealPrice !== null);
  const best = [...dealThreads].sort((a, b) => (a.dealPrice as number) - (b.dealPrice as number))[0];
  const liveCount = shown.filter((t) => t.status === "negotiating").length;
  const walked = shown.filter((t) => t.status === "walked_away").length;
  const paid = deals.filter((d) => d.status === "paid").length;

  return (
    <section aria-label="Negotiation" className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="break-words text-2xl font-bold tracking-tight">{want.item}</h2>
          {want.notes && <p className="mt-1 break-words text-sm text-muted">{want.notes}</p>}
          <p className="mt-1 text-sm text-muted" title={STYLE_INFO[want.style ?? "balanced"].description}>
            {STYLE_INFO[want.style ?? "balanced"].label} style · opens at {usd(openingOffer(want))}
          </p>
        </div>
        <button className={`${primary} shrink-0`} disabled={!canNegotiate || busy} onClick={onNegotiate}>
          {started ? "Restart" : "Negotiate"}
        </button>
      </div>

      {!started ? (
        <div className="rounded-md border border-dashed border-line bg-paper p-6">
          <h3 className="text-lg font-semibold">Ready to negotiate</h3>
          <p className="mt-1 text-sm text-muted">
            {want.sellers.length === 0
              ? "Add at least one seller in the sidebar, then press Negotiate."
              : `Hagglebot will chat with ${want.sellers.length} seller${want.sellers.length === 1 ? "" : "s"} at once. Your budget of ${usd(want.maxPrice)} is never shown to them. Press Negotiate to start.`}
          </p>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Your budget" value={usd(want.maxPrice)} note="never shown to sellers" />
            <Stat
              label={liveCount > 0 ? "Talking now" : "Sellers"}
              value={liveCount > 0 ? `${liveCount} of ${shown.length}` : String(shown.length)}
              note={liveCount > 0 ? "conversations live" : `${walked} walked away`}
            />
            <Stat
              label="Best deal"
              value={best ? usd(best.dealPrice) : "–"}
              note={best ? `${usd(want.maxPrice - (best.dealPrice as number))} under budget` : liveCount > 0 ? "still haggling" : "no deal yet"}
            />
            <Stat
              label="Deals ready"
              value={String(dealThreads.length)}
              note={
                dealThreads.length > 0 ? (
                  <>
                    {paid > 0 ? `${paid} paid · ` : ""}
                    <button className="font-medium text-ultra underline-offset-4 hover:underline" onClick={() => setView("deals")}>
                      Review and pay
                    </button>
                  </>
                ) : (
                  "waiting for a price"
                )
              }
            />
          </dl>

          {replaying && (
            <p className="text-sm text-muted">
              Replaying the negotiation.{" "}
              <button className="rounded-full border border-line px-2.5 py-0.5 font-medium text-ultra" onClick={skipReplay}>Skip</button>
            </p>
          )}

          <div role="tablist" aria-label="Negotiation views" className="flex gap-1 border-b border-line">
            {(
              [
                ["conversations", `Conversations (${shown.length})`],
                ["deals", deals.length > 0 ? `Deals (${deals.length})` : "Deals"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                  view === id ? "border-ultra text-ultra" : "border-transparent text-muted [@media(hover:hover)]:hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "conversations" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
              <div className={`min-w-0 xl:sticky xl:top-[4.5rem] xl:self-start ${showDetail ? "hidden xl:block" : ""}`}>
                <Inbox
                  threads={shown}
                  selectedId={selected?.id}
                  unread={(t) => t.messages.length > (read[t.id] ?? 0)}
                  onSelect={(id) => {
                    setPick({ wantId: want.id, id });
                    setShowDetail(true);
                  }}
                />
              </div>
              <div className={`min-w-0 ${showDetail ? "" : "hidden xl:block"}`}>
                {selected && (
                  <Detail t={selected} budget={want.maxPrice} axis={axis} busy={busy} replay={replaying} run={run} onBack={() => setShowDetail(false)} />
                )}
              </div>
            </div>
          ) : (
            <DealsPanel deals={deals} wants={wants} paypalClientId={paypalClientId} buyerEmail={buyerEmail} onChanged={onChanged} onError={onError} />
          )}
        </>
      )}
    </section>
  );
}
