"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { DealsPanel } from "./DealsPanel";
import { NegotiationsPanel } from "./NegotiationsPanel";
import { WantsPanel } from "./WantsPanel";

type Tab = "wants" | "negotiations" | "deals";
const TABS: { id: Tab; label: string }[] = [
  { id: "wants", label: "Wants" },
  { id: "negotiations", label: "Negotiations" },
  { id: "deals", label: "Deals" },
];

export function Dashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [selectedWant, setSelectedWant] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("wants");
  const [error, setError] = useState<string | null>(null);
  const live = useRef(false);

  const refresh = useCallback(async () => {
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

  const wants = state?.wants ?? [];
  const selected = useMemo(
    () => wants.find((w) => w.id === selectedWant) ?? wants[0],
    [wants, selectedWant],
  );
  const threads = (state?.threads ?? []).filter((t) => t.wantId === selected?.id);
  const deals = (state?.deals ?? []).filter((d) => d.wantId === selected?.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hagglebot</h1>
          <p className="text-sm text-muted">An AI buyer agent that negotiates for you and pays via PayPal.</p>
        </div>
        <p className="rounded-full border border-line px-3 py-1 text-xs text-muted" data-testid="mode-badge">
          Sandbox only · Simulated sellers · {state?.config.llmMode === "llm" ? "AI-written messages" : "template negotiator"}
        </p>
      </header>

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
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <div className={tab === "wants" ? "" : "hidden lg:block"}>
            <WantsPanel
              wants={wants}
              selectedId={selected?.id ?? null}
              onSelect={(id) => { setSelectedWant(id); setTab("negotiations"); }}
              onChanged={refresh}
              onError={setError}
            />
          </div>
          <div className={tab === "negotiations" ? "" : "hidden lg:block"}>
            <NegotiationsPanel want={selected} threads={threads} onChanged={refresh} onError={setError} />
          </div>
          <div className={tab === "deals" ? "" : "hidden lg:block"}>
            <DealsPanel deals={deals} wants={wants} paypalClientId={state.config.paypalClientId} buyerEmail={state.config.paypalBuyerEmail} onChanged={refresh} onError={setError} />
          </div>
        </div>
      )}

      <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">
        Hagglebot always identifies itself as an AI agent, never exceeds your budget, and only pays through the PayPal sandbox. Demo software, not financial advice.
      </footer>
    </div>
  );
}
