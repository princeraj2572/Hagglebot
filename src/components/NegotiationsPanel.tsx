"use client";
import { useState } from "react";
import type { Thread } from "@/lib/negotiation/types";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { REASON_LABEL, usd } from "./format";
import { StatusChip } from "./StatusChip";

type Want = DashboardState["wants"][number];

const btn =
  "rounded-md px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

export function NegotiationsPanel(props: {
  want: Want | undefined;
  threads: Thread[];
  onOpen: (threadId: string) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { want, threads, onOpen, onChanged, onError } = props;
  const [busy, setBusy] = useState(false);

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

  if (!want) return <p className="text-sm text-slate-500">Select a want to see its negotiations.</p>;
  const started = threads.length > 0;
  const live = threads.some((t) => t.status === "negotiating");

  return (
    <section aria-label="Negotiations" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Negotiations</h2>
        <button
          className={`${btn} bg-accent text-navy-950 hover:brightness-110`}
          disabled={busy || live || want.status !== "open" || want.sellers.length === 0}
          onClick={() => run(() => api(`/api/wants/${want.id}/negotiate${started ? "?restart=1" : ""}`, "POST"))}
        >
          {started ? "Restart" : "Negotiate"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {want.item}, budget {usd(want.maxPrice)} (never shown to sellers).
      </p>

      {!started && (
        <p className="text-sm text-slate-500">
          {want.sellers.length === 0 ? "Add at least one seller, then press Negotiate." : "Press Negotiate to start a chat with every seller in parallel."}
        </p>
      )}

      <ul className="space-y-3">
        {threads.map((t) => {
          const last = t.messages.at(-1);
          return (
            <li key={t.id} className="rounded-lg border border-navy-800 bg-navy-900 p-4" data-testid={`thread-${t.sellerName}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-100">{t.sellerName}</span>
                <StatusChip status={t.status} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Stat label="Our offer" value={usd(t.lastOffer)} />
                <Stat label="Their ask" value={usd(t.lastAsk)} />
                <Stat label="Messages" value={String(t.messages.length)} />
              </dl>
              {t.status === "deal" && <p className="mt-2 text-sm text-accent">Deal at {usd(t.dealPrice)}</p>}
              {t.status === "walked_away" && t.reason && (
                <p className={`mt-2 text-xs ${t.reason === "scam_detected" ? "text-rose-300" : "text-slate-400"}`}>
                  {REASON_LABEL[t.reason]}
                  {t.detail ? ` (${t.detail})` : ""}
                </p>
              )}
              {t.status === "paused" && t.detail && <p className="mt-2 text-xs text-slate-400">{t.detail}</p>}
              {last && <p className="mt-2 line-clamp-2 text-xs text-slate-400">“{last.text}”</p>}
              <div className="mt-3 flex gap-2">
                <button className={`${btn} border border-navy-800 text-slate-200 hover:border-accent/60`} onClick={() => onOpen(t.id)}>
                  Open chat
                </button>
                {t.status === "negotiating" && (
                  <button className={`${btn} border border-slate-600 text-slate-200 hover:border-rose-300`} disabled={busy}
                    onClick={() => run(() => api(`/api/threads/${t.id}/pause`, "POST"))}>
                    Pause
                  </button>
                )}
                {t.status === "paused" && (
                  <button className={`${btn} border border-accent/60 text-accent`} disabled={busy}
                    onClick={() => run(() => api(`/api/threads/${t.id}/resume`, "POST"))}>
                    Resume
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-100">{value}</dd>
    </div>
  );
}
