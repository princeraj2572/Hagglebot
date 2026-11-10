"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { CopilotView } from "./CopilotView";
import { MarketplaceView } from "./MarketplaceView";
import { ScorecardView } from "./ScorecardView";
import { NegotiationsPanel } from "./NegotiationsPanel";
import { Hero } from "./Hero";
import { Topbar, type NavPage } from "./Topbar";
import { WantsPanel } from "./WantsPanel";

/** Where the last dashboard is kept so the next visit can show it before the server answers. */
const STATE_CACHE = "hagglebot-state";

type Tab = "wants" | "negotiation";
const TABS: { id: Tab; label: string }[] = [
  { id: "wants", label: "Wants" },
  { id: "negotiation", label: "Negotiation" },
];

export function Dashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [selectedWant, setSelectedWant] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("negotiation");
  const [page, setPage] = useState<Exclude<NavPage, "home">>("negotiate");
  // After buying at the listed price, land on the Deals tab so the next step (pay) is in front of you.
  const [focus, setFocus] = useState<{ view: "deals" } | null>(null);
  // Progress of "find sellers and negotiate for me" for one want, shown on its page.
  const [auto, setAuto] = useState<{ wantId: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(false);
  // The welcome screen's button opens the New want dialog in the sidebar.
  // The hero is the first screen for someone with nothing yet; "Continue" (or starting a want) enters the dashboard.
  const [entered, setEntered] = useState<boolean | null>(null); // null until the browser's saved settings are read
  useEffect(() => {
    try {
      setEntered(localStorage.getItem("hagglebot-entered") === "1");
      // Show the last dashboard straight away; the live one replaces it a moment later.
      const saved = localStorage.getItem(STATE_CACHE);
      if (saved) setState((cur) => cur ?? (JSON.parse(saved) as DashboardState));
    } catch {
      setEntered(false);
    }
  }, []);
  const enter = () => {
    setEntered(true);
    try {
      localStorage.setItem("hagglebot-entered", "1");
    } catch {
      /* the hero just shows again next visit */
    }
  };
  const [newWantSignal, setNewWantSignal] = useState(0);
  const [preset, setPreset] = useState<{ item: string; maxPrice: string; notes: string } | null>(null);

  const refresh = useCallback(async () => {
    // Dev-only stress fixture (?data=worst); the NODE_ENV check is inlined by Next, so it is dead code in production.
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("data") === "worst") {
      void import("./worstCase").then((m) => setState(m.worstCaseState()));
      return;
    }
    try {
      const s = await api<DashboardState>("/api/state");
      live.current = s.threads.some((t) => t.status === "negotiating");
      setState(s);
      try {
        localStorage.setItem(STATE_CACHE, JSON.stringify(s));
      } catch {
        /* storage full or blocked: the next visit just waits for the server */
      }
      setError((e) => (e?.startsWith("Lost connection") ? null : e));
    } catch {
      setError("Lost connection to the Hagglebot server. Retrying…");
    }
  }, []);

  // Poll faster while any negotiation is running so the transcript reads live.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await refresh();
      if (!stop) timer = setTimeout(tick, live.current ? 1000 : 3000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await fn();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  /**
   * Find sellers and negotiate, in order: search the marketplace for the want's item and add the best offers; if there
   * is nothing suitable (or no marketplace), use simulated sellers instead; then start the negotiation.
   */
  const autopilot = async (wantId: string) => {
    try {
      setAuto({ wantId, text: "Searching the marketplace for the best offers…" });
      let found = 0;
      let simulated = false;
      try {
        found = (await api<unknown[]>(`/api/wants/${wantId}/listings`, "POST")).length;
      } catch {
        simulated = true; // nothing near the budget, or the marketplace is not set up
      }
      if (simulated) {
        setAuto({ wantId, text: "No suitable marketplace listings, so Hagglebot is using simulated sellers…" });
        const pool = ["ferdi", "fatima", "chen", "bea", "tomas", "leo", "priya", "wei", "nina", "gus", "clara"];
        const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        for (const persona of picks) await api(`/api/wants/${wantId}/sellers`, "POST", { persona });
        found = picks.length;
      }
      setAuto({ wantId, text: `Negotiating with ${found} seller${found === 1 ? "" : "s"}…` });
      await api(`/api/wants/${wantId}/negotiate`, "POST");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuto(null);
    }
  };

  const wants = state?.wants ?? [];
  const selected = useMemo(
    () => wants.find((w) => w.id === selectedWant) ?? wants[0],
    [wants, selectedWant],
  );
  const threads = (state?.threads ?? []).filter((t) => t.wantId === selected?.id);
  const deals = (state?.deals ?? []).filter((d) => d.wantId === selected?.id);
  const started = threads.length > 0;
  // Sellers with no conversation yet (added after a purchase or a run): Negotiate talks to them without redoing the rest.
  const hasNewSellers = (selected?.sellers ?? []).some((s) => !threads.some((t) => t.sellerId === s.id));
  const restarting = started && !hasNewSellers;
  const liveCount = threads.filter((t) => t.status === "negotiating").length;

  const navigate = (p: NavPage) => {
    if (p === "home") {
      setEntered(false);
      return;
    }
    enter();
    setPage(p);
    setTab("negotiation"); // on phones, show the page itself rather than the Wants list
  };

  if (state === null || entered === null) {
    return (
      <div className="grid min-h-screen place-items-center" role="status" aria-label="Loading">
        <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white motion-safe:animate-pulse">H</span>
      </div>
    );
  }

  const showHero = !entered;
  if (showHero) {
    return (
      <Hero
        nav={{ onNavigate: navigate, live: liveCount, total: threads.length, marketplace: state?.config.listings ?? false }}
        onContinue={enter}
        onStart={(p) => {
          enter();
          setPreset(p);
          setNewWantSignal((n) => n + 1);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar
        page={page}
        onNavigate={navigate}
        live={liveCount}
        total={threads.length}
        marketplace={state?.config.listings ?? false}
      />

      <div className="mx-auto max-w-7xl px-3 pb-6 pt-3 sm:px-5 sm:pt-4">
        {error && (
          <p role="alert" className="mb-4 border-l-4 border-scam bg-paper px-3 py-2 text-sm text-scam">
            {error}{" "}
            <button className="underline" onClick={() => setError(null)}>dismiss</button>
          </p>
        )}

        <nav className={`mb-4 flex gap-1 border-b border-line lg:hidden ${page === "copilot" || page === "scorecard" ? "hidden" : ""}`} aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id}
              className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium transition-[color,border-color,transform] duration-150 ease-out-strong active:scale-[0.97] ${
                tab === t.id ? "border-ultra text-ultra" : "border-transparent text-muted"
              }`}>
              {t.id === "negotiation" && page === "marketplace" ? "Marketplace" : t.label}
            </button>
          ))}
        </nav>

        {page === "copilot" || page === "scorecard" ? (
          <main key={page} className="rounded-[28px] border border-line bg-paper p-4 motion-safe:animate-fade-in sm:p-6">
            {page === "copilot" ? <CopilotView /> : <ScorecardView />}
          </main>
        ) : (

          <div className="grid grid-cols-1 gap-4 rounded-[28px] border border-line bg-paper p-3 sm:p-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className={`min-w-0 rounded-2xl bg-chalk p-3 sm:p-4 ${tab === "wants" ? "" : "hidden lg:block"}`}>
              <WantsPanel
                wants={wants}
                bundles={state.bundles}
                threads={state.threads}
                deals={state.deals}
                selectedId={selected?.id ?? null}
                onSelect={(id) => { setSelectedWant(id); setTab("negotiation"); }}
                onChanged={refresh}
                onError={setError}
                onAutopilot={(id) => void autopilot(id)}
                openNewWant={newWantSignal}
                preset={preset}
              />
            </aside>
            <main key={page} className={`min-w-0 p-1 motion-safe:animate-fade-in sm:p-3 ${tab === "negotiation" ? "" : "hidden lg:block"}`}>
              {page === "marketplace" ? (
                <MarketplaceView key={selected?.id ?? "none"} want={selected} canAdd={liveCount === 0} run={run} onError={setError} onBought={() => { setFocus({ view: "deals" }); setPage("negotiate"); }} onGoToWant={() => setPage("negotiate")} />
              ) : (
                <NegotiationsPanel
                  want={selected}
                  threads={threads}
                  deals={deals}
                  wants={wants}
                  bundle={state.bundles.find((b) => b.id === selected?.bundleId)}
                  bundles={state.bundles}
                  listings={state.config.listings}
                  busy={busy}
                restart={restarting}
                onFindProducts={state.config.listings ? () => setPage("marketplace") : undefined}
                focus={focus}
                autoStatus={auto && auto.wantId === selected?.id ? auto.text : null}
                onFocusDone={() => setFocus(null)}
                onNewWant={(p) => { setPreset(p ?? null); setNewWantSignal((n) => n + 1); }}
                canNegotiate={!!selected && selected.status === "open" && selected.sellers.length > 0 && liveCount === 0}
                  onNegotiate={() => selected && run(() => api(`/api/wants/${selected.id}/negotiate${restarting ? "?restart=1" : ""}`, "POST"))}
                  run={run}
                  onChanged={refresh}
                  onError={setError}
                />
              )}
            </main>
          </div>
        )}

        <footer className="mt-10 border-t border-line pt-4 text-[13px] text-muted">
          Hagglebot always identifies itself as an AI agent and never exceeds your budget. Sellers, negotiation and payments are simulated: no real money moves.
        </footer>
      </div>
    </div>
  );
}
