"use client";
import { useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import type { Deal, WantRecord } from "@/server/repo";
import type { DashboardState } from "@/server/state";
import { DealsPanel } from "./DealsPanel";
import { Detail } from "./Detail";
import { usd } from "./format";
import { Inbox } from "./Inbox";
import { SavingsPanel } from "./SavingsPanel";
import { dealSavings } from "@/lib/negotiation/savings";
import { ListingsPanel } from "./ListingsPanel";
import { axisFor } from "./Lane";
import { primary } from "./ui";
import { listingFromEndpoint } from "@/lib/sellers/listing";
import { openingOffer, STYLE_INFO } from "@/lib/negotiation/strategy";

type Want = DashboardState["wants"][number];
type View = "conversations" | "deals" | "listings";

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
  deals: Deal[];
  wants: WantRecord[];
  /** The bundle this want belongs to, if any. */
  bundle: DashboardState["bundles"][number] | undefined;
  paypalClientId: string | null;
  buyerEmail: string | null;
  busy: boolean;
  demo: boolean;
  /** True when the button redoes everything (Restart); false when it only starts new sellers or a first run. */
  restart: boolean;
  /** First-run shortcut: load the demo scenario and select it. */
  onLoadDemo?: () => void;
  canNegotiate: boolean;
  onNegotiate: () => void;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { want, threads, deals, wants, bundle, paypalClientId, buyerEmail, busy, demo, restart, onLoadDemo, canNegotiate, onNegotiate, run, onChanged, onError } = props;

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
      <section aria-label="Welcome" className="overflow-hidden rounded-3xl bg-ink p-7 text-white sm:p-10">
        <h2 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">An AI agent that haggles for you.</h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/75">
          Tell it what you want and the most you will pay. It talks to every seller at once, never goes over your budget and walks away from scams.
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            ["1", "Say what you want", "An item, your maximum price and how hard to haggle."],
            ["2", "Watch it negotiate", "Every seller at once, with the reason behind each move."],
            ["3", "Pay through PayPal", "When a seller agrees to a price inside your budget."],
          ].map(([n, title, text]) => (
            <li key={n} className="rounded-2xl bg-white/[0.07] p-4">
              <span className="num inline-flex h-7 w-7 items-center justify-center rounded-full bg-ultra text-sm font-bold">{n}</span>
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-white/65">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          {onLoadDemo && (
            <button className="rounded-full bg-white px-5 py-2.5 font-semibold text-ink transition-transform duration-150 active:scale-[0.97] [@media(hover:hover)]:hover:bg-tag" onClick={onLoadDemo}>
              Load the demo scenario
            </button>
          )}
          <span className="text-sm text-white/60">or add a want in the sidebar</span>
        </div>
      </section>
    );
  }

  // A want in a bundle may spend at most what is left of the bundle, minus what other wants in it have paid.
  const ownPaid = deals.filter((d) => d.status === "paid").reduce((sum, d) => sum + d.price, 0);
  const bundleRoom = bundle ? Math.max(0, bundle.total - (bundle.spent - ownPaid)) : null;
  const budget = bundleRoom === null ? want.maxPrice : Math.min(want.maxPrice, bundleRoom);
  const axis = axisFor(budget, threads);
  const listingCount = want.sellers.filter((s) => listingFromEndpoint(s.endpoint)).length;
  const dealThreads = shown.filter((t) => t.status === "deal" && t.dealPrice !== null);
  const savings = dealSavings(shown, budget);
  const liveCount = shown.filter((t) => t.status === "negotiating").length;
  const walked = shown.filter((t) => t.status === "walked_away").length;
  const paid = deals.filter((d) => d.status === "paid").length;
  const sentence = savings
    ? `${savings.best.saved > 0 ? `${usd(savings.best.saved)} off ${savings.best.seller}${savings.best.savedPct > 0 ? ` (${savings.best.savedPct}%)` : ""}` : `${savings.best.seller} ${savings.best.direct ? "was bought at its listed price" : "agreed at its first price"}`}, and ${usd(savings.best.underBudget)} under your ${usd(budget)} budget.`
    : liveCount > 0
      ? `Hagglebot is talking to every seller at once. Your budget of ${usd(budget)} is never shown to them.`
      : walked > 0
        ? "No seller has reached a price inside your budget yet."
        : "";
  const meta = [
    `${STYLE_INFO[want.style ?? "balanced"].label} style`,
    `opens at ${usd(openingOffer(want))}`,
    ...(want.requireApproval ? ["asks before accepting"] : []),
  ];

  return (
    <section aria-label="Negotiation" className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
        <div className="min-w-0 flex-1 basis-72">
          <h2 className="break-words text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">{want.item}</h2>
          {want.notes && <p className="mt-2 break-words text-base text-muted">{want.notes}</p>}
          <ul className="mt-3 flex flex-wrap gap-2" title={STYLE_INFO[want.style ?? "balanced"].description}>
            {meta.map((m) => (
              <li key={m} className="rounded-full bg-mist px-3 py-1 text-[13px] font-medium text-muted">{m}</li>
            ))}
            {bundle && (
              <li className="num rounded-full bg-mist px-3 py-1 text-[13px] font-medium text-muted">
                Bundle "{bundle.name}": {usd(bundle.spent)} of {usd(bundle.total)} spent, {usd(bundleRoom)} left for this want
              </li>
            )}
          </ul>
        </div>
        <button
          className={`${primary} shrink-0 rounded-full px-6 py-2.5 text-base`}
          disabled={!canNegotiate || busy}
          onClick={onNegotiate}
        >
          {restart ? "Restart" : "Negotiate"}
        </button>
      </div>

      {!started ? (
        <div className="space-y-6">
          {listingCount > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight">Real listings found ({listingCount})</h3>
              <ListingsPanel sellers={want.sellers} threads={[]} />
            </div>
          )}
          <div className="rounded-2xl bg-paper p-6">
            <h3 className="text-lg font-semibold">Ready to negotiate</h3>
            <p className="mt-1 max-w-2xl text-muted">
              {want.sellers.length === 0
                ? "Add at least one seller in the sidebar, then press Negotiate."
                : `Hagglebot will chat with ${want.sellers.length} seller${want.sellers.length === 1 ? "" : "s"} at once. Your budget of ${usd(want.maxPrice)} is never shown to them. Press Negotiate to start.`}
            </p>
          </div>
        </div>
      ) : (
        <>
          <section aria-label="Scoreboard" className="rounded-3xl bg-ink p-5 text-white sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/65">{savings ? "Best deal" : liveCount > 0 ? "Haggling now" : "No deal yet"}</p>
                <p className="num mt-1 text-5xl font-bold leading-none tracking-tight sm:text-7xl">
                  {savings ? usd(savings.best.price) : liveCount > 0 ? `${liveCount} of ${shown.length}` : "–"}
                </p>
                {sentence && <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80">{sentence}</p>}
              </div>
              <dl className="flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dt className="text-sm text-white/60">Your budget</dt>
                  <dd className="num text-2xl font-bold">{usd(budget)}</dd>
                  <dd className="text-[13px] text-white/55">{budget < want.maxPrice ? `limited by the ${bundle?.name} bundle` : "never shown to sellers"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60">{liveCount > 0 ? "Talking now" : "Sellers"}</dt>
                  <dd className="num text-2xl font-bold">{liveCount > 0 ? `${liveCount} of ${shown.length}` : String(Math.max(shown.length, want.sellers.length))}</dd>
                  <dd className="text-[13px] text-white/55">{liveCount > 0 ? "conversations live" : `${walked} walked away`}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/60">Deals ready</dt>
                  <dd className="num text-2xl font-bold">{dealThreads.length}</dd>
                  <dd className="text-[13px] text-white/55">
                    {dealThreads.length > 0 ? (
                      <>
                        {paid > 0 ? `${paid} paid · ` : ""}
                        <button className="font-semibold text-tag underline-offset-4 hover:underline" onClick={() => setView("deals")}>
                          Review and pay
                        </button>
                      </>
                    ) : (
                      "waiting for a price"
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            {replaying && (
              <p className="mt-5 text-sm text-white/70">
                Replaying the negotiation.{" "}
                <button className="rounded-full bg-white/15 px-3 py-0.5 font-semibold text-white [@media(hover:hover)]:hover:bg-white/25" onClick={skipReplay}>Skip</button>
              </p>
            )}
          </section>

          <SavingsPanel threads={shown} budget={budget} />

          <div role="tablist" aria-label="Negotiation views" className="flex flex-wrap gap-2">
            {(
              [
                ...(listingCount > 0 ? ([["listings", `Listings (${listingCount})`]] as const) : []),
                ["conversations", `Conversations (${shown.length})`],
                ["deals", deals.length > 0 ? `Deals (${deals.length})` : "Deals"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors duration-150 ${
                  view === id ? "bg-ink text-white" : "bg-mist text-muted [@media(hover:hover)]:hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "conversations" ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
              <div className={`min-w-0 xl:sticky xl:top-[5rem] xl:self-start ${showDetail ? "hidden xl:block" : ""}`}>
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
          ) : view === "listings" ? (
            <ListingsPanel sellers={want.sellers} threads={shown} />
          ) : (
            <DealsPanel deals={deals} wants={wants} demo={demo} paypalClientId={paypalClientId} buyerEmail={buyerEmail} onChanged={onChanged} onError={onError} />
          )}
        </>
      )}
    </section>
  );
}
