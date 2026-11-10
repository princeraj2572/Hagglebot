"use client";
import { useCallback, useEffect, useState } from "react";
import type { Scorecard } from "@/lib/negotiation/benchmark";
import { api } from "./api";
import { ghost } from "./ui";

function Tile({ value, label, detail, good }: { value: string; label: string; detail: string; good?: boolean }) {
  return (
    <div className="rounded-xl bg-mist p-4">
      <p className={`num font-display text-3xl font-semibold tracking-tight ${good ? "text-[#15803D]" : "text-ink"}`}>{value}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="text-[13px] text-muted">{detail}</p>
    </div>
  );
}

/** Proof, not promises: the safety claims measured over many full negotiations. */
export function ScorecardView() {
  const [card, setCard] = useState<Scorecard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      setCard(await api<Scorecard>("/api/benchmark?n=200"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => void run(), [run]);

  return (
    <section aria-label="Scorecard" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight">Scorecard</h2>
          <p className="max-w-[62ch] text-sm text-muted">
            {card ? card.runs : 200} full negotiations against every seller persona, scammers and prompt-injection attackers included, with random budgets and all three styles. Same engine and guardrails as the dashboard.
          </p>
        </div>
        <button className={ghost} disabled={busy} onClick={() => void run()}>{busy ? "Running…" : "Run again"}</button>
      </div>
      {error && <p role="alert" className="text-sm text-scam">{error}</p>}
      {card && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Tile good={card.budgetBreaches === 0} value={`${card.budgetBreaches} / ${card.deals}`} label="Budget breaches" detail="Deals closed above the budget." />
          <Tile good={card.scamDeals === 0} value={`${card.scamDeals} / ${card.scamAttempts}`} label="Deals with scammers" detail={`${card.scamAttempts} sellers tried hidden fees or off-platform payment. Hagglebot paid none of them.`} />
          <Tile good={card.budgetLeaks === 0} value={`${card.budgetLeaks}`} label="Budget leaks" detail="Messages that revealed the budget figure." />
          <Tile good={card.injectionsFlagged === card.injectionAttempts} value={`${card.injectionsFlagged} / ${card.injectionAttempts}`} label="Prompt injections caught" detail="Fake system messages and budget fishing, flagged and ignored." />
          <Tile value={`${Math.round(card.avgSaved * 100)}%`} label="Average saved" detail="Below the seller's first ask, across closed deals." />
          <Tile value={`${card.deals} / ${card.runs}`} label="Deals closed" detail="The rest walked away: over budget, stubborn or unsafe sellers." />
        </div>
      )}
    </section>
  );
}
