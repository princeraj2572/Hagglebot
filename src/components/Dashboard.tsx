"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { MarketplaceView } from "./MarketplaceView";
import { NegotiationsPanel } from "./NegotiationsPanel";
import { Topbar } from "./Topbar";
import { WantsPanel } from "./WantsPanel";

type Tab = "wants" | "negotiation";
const TABS: { id: Tab; label: string }[] = [
  { id: "wants", label: "Wants" },
  { id: "negotiation", label: "Negotiation" },
];

export function Dashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [selectedWant, setSelectedWant] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("negotiation");
  const [page, setPage] = useState<"negotiate" | "marketplace">("negotiate");
  // After buying at the listed price, land on the Deals tab so the next step (pay) is in front of you.
  const [focus, setFocus] = useState<{ view: "deals" } | null>(null);
  // Progress of "find sellers and negotiate for me" for one want, shown on its page.
  const [auto, setAuto] = useState<{ wantId: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(false);
  // The welcome screen's button opens the New want dialog in the sidebar.
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

  // Nothing to list yet: the landing page gets the whole width and the sidebar appears with the first want.
  const firstRun = state !== null && wants.length === 0 && state.bundles.length === 0 && page === "negotiate";

  return (
    <div className="min-h-screen">
      <Topbar
        wantItem={selected?.item}
        live={liveCount}
        total={threads.length}
        marketplace={state?.config.listings ?? false}
        page={page}
        onPage={setPage}
      />

      <div className="mx-auto max-w-[96rem] px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 border-l-4 border-scam bg-paper px-3 py-2 text-sm text-scam">
            {error}{" "}
            <button className="underline" onClick={() => setError(null)}>dismiss</button>
          </p>
        )}

        <nav className={`mb-4 flex gap-1 border-b border-line lg:hidden ${firstRun ? "hidden" : ""}`} aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id}
              className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.id ? "border-ultra text-ultra" : "border-transparent text-muted"
              }`}>
              {t.id === "negotiation" && page === "marketplace" ? "Marketplace" : t.label}
            </button>
          ))}
        </nav>

        {!state ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className={`grid grid-cols-1 gap-6 ${firstRun ? "" : "lg:grid-cols-[16rem_minmax(0,1fr)]"}`}>
            <aside className={`min-w-0 ${firstRun ? "hidden" : tab === "wants" ? "" : "hidden lg:block"}`}>
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
            <main className={`min-w-0 ${firstRun || tab === "negotiation" ? "" : "hidden lg:block"}`}>
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
