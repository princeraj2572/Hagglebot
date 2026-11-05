"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = useRef(false);

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

  const wants = state?.wants ?? [];
  const selected = useMemo(
    () => wants.find((w) => w.id === selectedWant) ?? wants[0],
    [wants, selectedWant],
  );
  const threads = (state?.threads ?? []).filter((t) => t.wantId === selected?.id);
  const deals = (state?.deals ?? []).filter((d) => d.wantId === selected?.id);
  const started = threads.length > 0;
  const liveCount = threads.filter((t) => t.status === "negotiating").length;

  return (
    <div className="min-h-screen">
      <Topbar
        wantItem={selected?.item}
        llmMode={state?.config.llmMode}
        live={liveCount}
        total={threads.length}
        started={started}
        busy={busy}
        canNegotiate={!!selected && selected.status === "open" && selected.sellers.length > 0 && liveCount === 0}
        onNegotiate={() => selected && run(() => api(`/api/wants/${selected.id}/negotiate${started ? "?restart=1" : ""}`, "POST"))}
      />

      <div className="mx-auto max-w-[96rem] px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 border-l-4 border-scam bg-paper px-3 py-2 text-sm text-scam">
            {error}{" "}
            <button className="underline" onClick={() => setError(null)}>dismiss</button>
          </p>
        )}

        <nav className="mb-4 flex gap-1 border-b border-line lg:hidden" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id}
              className={`flex-1 border-b-2 px-3 py-2 text-sm font-medium ${
                tab === t.id ? "border-ultra text-ultra" : "border-transparent text-muted"
              }`}>
              {t.label}
            </button>
          ))}
        </nav>

        {!state ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className={`min-w-0 ${tab === "wants" ? "" : "hidden lg:block"}`}>
              <WantsPanel
                wants={wants}
                selectedId={selected?.id ?? null}
                onSelect={(id) => { setSelectedWant(id); setTab("negotiation"); }}
                onChanged={refresh}
                onError={setError}
              />
            </aside>
            <main className={`min-w-0 ${tab === "negotiation" ? "" : "hidden lg:block"}`}>
              <NegotiationsPanel
                want={selected}
                threads={threads}
                deals={deals}
                wants={wants}
                paypalClientId={state.config.paypalClientId}
                buyerEmail={state.config.paypalBuyerEmail}
                busy={busy}
                run={run}
                onChanged={refresh}
                onError={setError}
              />
            </main>
          </div>
        )}

        <footer className="mt-10 border-t border-line pt-4 text-[13px] text-muted">
          Hagglebot always identifies itself as an AI agent, never exceeds your budget, and only pays through the PayPal sandbox. Demo software, not financial advice.
        </footer>
      </div>
    </div>
  );
}
