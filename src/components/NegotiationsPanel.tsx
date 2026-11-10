"use client";
import { useEffect, useRef, useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import type { Deal, WantRecord } from "@/server/repo";
import type { DashboardState } from "@/server/state";
import { DealsPanel } from "./DealsPanel";
import { Detail } from "./Detail";
import { usd } from "./format";
import { Inbox } from "./Inbox";
import { ManagePanel } from "./ManagePanel";
import { Modal } from "./Modal";
import { PriceLadder } from "./PriceLadder";
import { Landing, type Preset } from "./Landing";
import { SavingsPanel } from "./SavingsPanel";
import { dealSavings } from "@/lib/negotiation/savings";
import { ListingsPanel } from "./ListingsPanel";
import { axisFor } from "./Lane";
import { ghost, primary } from "./ui";
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

/** Wants whose finished negotiation has already been replayed in this browser session (survives switching pages). */
const replayed = new Set<string>();

export function NegotiationsPanel(props: {
  want: Want | undefined;
  threads: Thread[];
  deals: Deal[];
  wants: WantRecord[];
  /** The bundle this want belongs to, if any. */
  bundle: DashboardState["bundles"][number] | undefined;
  /** Every bundle, for the manage drawer. */
  bundles: DashboardState["bundles"];
  /** True when a Channel3 key is set, so real listings can be added. */
  listings: boolean;
  busy: boolean;
  /** True when the button redoes everything (Restart); false when it only starts new sellers or a first run. */
  restart: boolean;
  /** What "find sellers and negotiate for me" is doing right now, if it is running for this want. */
  autoStatus?: string | null;
  /** Opens the marketplace, searched for this want. Only given when the marketplace is available. */
  onFindProducts?: (() => void) | undefined;
  /** Ask the panel to open a tab once (for example Deals right after a purchase). */
  focus?: { view: "deals" } | null;
  onFocusDone?: () => void;
  /** First-run shortcut: open the New want dialog. */
  onNewWant?: (preset?: Preset) => void;
  canNegotiate: boolean;
  onNegotiate: () => void;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { want, threads, deals, wants, bundle, bundles, listings, busy, restart, autoStatus, onFindProducts, focus, onFocusDone, onNewWant, canNegotiate, onNegotiate, run, onChanged, onError } = props;

  // Negotiations that finished before this page opened replay once, so the haggling is visible.
  const seen = useRef(replayed);
  const [step, setStep] = useState(0);
  const [, rerender] = useState(0);
  const [view, setView] = useState<View>("conversations");
  const [pick, setPick] = useState<{ wantId: string; id: string } | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
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

  useEffect(() => setManageOpen(false), [wantId]);

  useEffect(() => {
    if (!focus) return;
    setView(focus.view);
    setShowDetail(false);
    onFocusDone?.();
    // Runs when a focus request arrives; onFocusDone clears it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

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
    return <Landing onStart={onNewWant} />;
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
        ? `No seller reached a price inside your ${usd(budget)} budget. Raise the budget, or add more sellers and press Negotiate.`
        : "";
  const pending = started && liveCount === 0 ? want.sellers.filter((s) => !threads.some((t) => t.sellerId === s.id)) : [];
  const meta = [
    `${STYLE_INFO[want.style ?? "balanced"].label} style`,
    `opens at ${usd(openingOffer(want))}`,
    ...(want.requireApproval ? ["asks before accepting"] : []),
  ];

  return (
    <section aria-label="Negotiation" className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
        <div className="min-w-0 flex-1 basis-60">
          <h2 className="break-words text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">{want.item}</h2>
          {want.notes && <p className="mt-2 break-words text-base text-muted">{want.notes}</p>}
          <ul className="mt-3 flex flex-wrap gap-2" title={STYLE_INFO[want.style ?? "balanced"].description}>
            {meta.map((m) => (
              <li key={m} className="rounded-md bg-mist px-3 py-1 text-[13px] font-medium text-muted">{m}</li>
            ))}
            {bundle && (
              <li className="num rounded-md bg-mist px-3 py-1 text-[13px] font-medium text-muted">
                Bundle "{bundle.name}": {usd(bundle.spent)} of {usd(bundle.total)} spent, {usd(bundleRoom)} left for this want
              </li>
            )}
          </ul>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {onFindProducts && (
            <button className={`${ghost} rounded-md px-5 py-2.5 text-base`} onClick={onFindProducts}>
              Find products
            </button>
          )}
          <button className={`${ghost} rounded-md px-5 py-2.5 text-base`} onClick={() => setManageOpen(true)}>
            Manage
          </button>
          <button
            className={`${primary} rounded-md px-6 py-2.5 text-base`}
            disabled={!canNegotiate || busy}
            onClick={onNegotiate}
          >
            {restart ? "Restart" : "Negotiate"}
          </button>
        </div>
      </div>

      {autoStatus && (
        <div role="status" className="flex items-center gap-3 rounded-xl bg-ultra px-4 py-3 text-white">
          <span aria-hidden className="inline-flex gap-1">
            {[0, 150, 300].map((delay) => (
              <i key={delay} className="h-2 w-2 rounded-full bg-white motion-safe:animate-typing" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
          <p className="text-sm font-medium">{autoStatus}</p>
        </div>
      )}

      {!started ? (
        <div className="space-y-6">
          {listingCount > 0 && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight">Real listings found ({listingCount})</h3>
              <ListingsPanel sellers={want.sellers} threads={[]} />
            </div>
          )}
          <div className="rounded-xl bg-paper p-6">
            <h3 className="text-lg font-semibold">Ready to negotiate</h3>
            <p className="mt-1 max-w-2xl text-muted">
              {want.sellers.length === 0
                ? "Add at least one seller, then press Negotiate."
                : `Hagglebot will chat with ${want.sellers.length} seller${want.sellers.length === 1 ? "" : "s"} at once. Your budget of ${usd(want.maxPrice)} is never shown to them. Press Negotiate to start.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {want.sellers.length === 0 && (
                <button className={primary} onClick={() => setManageOpen(true)}>
                  Add sellers
                </button>
              )}
              {onFindProducts && (
                <button className={want.sellers.length === 0 ? ghost : primary} onClick={onFindProducts}>
                  Find products for this want
                </button>
              )}
            </div>
            {onFindProducts && (
              <p className="mt-2 max-w-2xl text-[13px] text-muted">
                Search real listings for "{want.item}", check each one's condition (new, used or refurbished), then negotiate the ones you like.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ultra/10 px-4 py-3">
              <p className="min-w-0 flex-1 text-sm leading-snug">
                <b className="font-semibold">
                  {pending.length} new seller{pending.length === 1 ? "" : "s"} added
                </b>
                : {pending.map((s) => s.name).join(", ")}. They have not been talked to yet. Press Negotiate to start; the existing conversations stay as they are.
              </p>
              <button className={`${primary} shrink-0`} disabled={!canNegotiate || busy} onClick={onNegotiate}>
                Negotiate with {pending.length === 1 ? "it" : `${pending.length} new`}
              </button>
            </div>
          )}

          <section aria-label="Scoreboard" className="rounded-xl border border-line bg-paper p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
              <div className="min-w-0">
                <p className="text-sm text-muted">{savings ? "Best deal" : liveCount > 0 ? "Haggling now" : "Result"}</p>
                <p className={`num mt-1 text-5xl font-semibold leading-none sm:text-6xl ${savings ? "text-[#15803D]" : ""}`}>
                  {savings ? usd(savings.best.price) : liveCount > 0 ? `${liveCount} of ${shown.length}` : "No deal"}
                </p>
                {sentence && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{sentence}</p>}
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md bg-[#E8F0FE] px-2 py-1 text-[#1D4ED8]">
                  Budget <span className="num font-medium">{usd(budget)}</span>
                  {budget < want.maxPrice ? ` (limited by the ${bundle?.name} bundle)` : ""}
                </span>
                <span className={`rounded-md px-2 py-1 ${liveCount > 0 ? "bg-[#DCF5E4] text-[#15803D]" : "bg-mist text-muted"}`}>
                  {liveCount > 0 ? <><span className="num font-medium">{liveCount}</span> live</> : <><span className="num font-medium">{walked}</span> walked away</>}
                </span>
                {dealThreads.length > 0 && (
                  <button className="rounded-md bg-ink px-2 py-1 font-medium text-white transition-transform duration-150 active:scale-[0.97] [@media(hover:hover)]:hover:bg-[#2A2A2A]" onClick={() => setView("deals")}>
                    {paid > 0 ? `${paid} paid · ` : ""}{dealThreads.length} {dealThreads.length === 1 ? "deal" : "deals"} ready to pay
                  </button>
                )}
              </p>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <PriceLadder
                threads={shown}
                budget={budget}
                axis={axis}
                onOpen={(id) => {
                  setPick({ wantId: want.id, id });
                  setView("conversations");
                  setShowDetail(true);
                }}
              />
            </div>
            {replaying && (
              <p className="mt-5 text-sm text-muted">
                Replaying the negotiation.{" "}
                <button className="rounded-md bg-mist px-3 py-0.5 font-semibold text-ink [@media(hover:hover)]:hover:bg-[#E4E5E9]" onClick={skipReplay}>Skip</button>
              </p>
            )}
          </section>

          <SavingsPanel threads={shown} budget={budget} />

          <div role="tablist" aria-label="Negotiation views" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
                className={`shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-semibold transition-colors duration-150 ${
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
                  <Detail t={selected} budget={want.maxPrice} axis={axis} busy={busy} replay={replaying} live={want.sellers.some((s) => s.id === selected.sellerId && s.persona === "human")} run={run} onBack={() => setShowDetail(false)} />
                )}
              </div>
            </div>
          ) : view === "listings" ? (
            <ListingsPanel sellers={want.sellers} threads={shown} />
          ) : (
            <DealsPanel deals={deals} wants={wants} onChanged={onChanged} onError={onError} />
          )}
        </>
      )}

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title={`Manage: ${want.item}`} side="right">
        <ManagePanel want={want} bundles={bundles} listings={listings} busy={busy} run={run} onDeleted={() => setManageOpen(false)} />
      </Modal>
    </section>
  );
}
