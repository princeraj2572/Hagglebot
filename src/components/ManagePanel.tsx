"use client";
import { useState } from "react";
import { PERSONAS } from "@/lib/sellers/personas";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { Avatar, tagline } from "./Avatar";
import { usd } from "./format";
import { ghost, input } from "./ui";

type Want = DashboardState["wants"][number];
type Bundle = DashboardState["bundles"][number];

/** Everything about one want's setup: who the sellers are, which bundle it belongs to, and deleting it. */
export function ManagePanel(props: {
  want: Want;
  bundles: Bundle[];
  listings: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  /** Called after the want was deleted, so the drawer can close. */
  onDeleted: () => void;
}) {
  const { want: w, bundles, listings, busy, run, onDeleted } = props;
  const [persona, setPersona] = useState(PERSONAS[0]?.id ?? "ferdi");

  return (
    <div className="space-y-7">
      <section aria-label="Sellers" className="space-y-3">
        <h3 className="text-sm font-semibold">Sellers ({w.sellers.length})</h3>
        {w.sellers.length === 0 && <p className="text-sm text-muted">No sellers yet. Add one below, then press Negotiate.</p>}
        <ul className="space-y-1">
          {w.sellers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-lg bg-mist px-3 py-2.5 text-sm">
              <Avatar name={s.name} />
              <span className="min-w-0 flex-1">
                <span className="block break-words font-semibold leading-tight">{s.name}</span>
                <span className="block text-[13px] text-muted">{tagline(s.name)}</span>
              </span>
              <button
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors [@media(hover:hover)]:hover:bg-paper [@media(hover:hover)]:hover:text-scam"
                aria-label={`Remove ${s.name}`}
                disabled={busy}
                onClick={() => run(() => api(`/api/sellers/${s.id}`, "DELETE"))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <select className={input} value={persona} aria-label="Seller persona" onChange={(e) => setPersona(e.target.value)}>
            {PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className={ghost} disabled={busy} onClick={() => run(() => api(`/api/wants/${w.id}/sellers`, "POST", { persona }))}>
            Add seller
          </button>
        </div>

        {listings && (
          <div className="rounded-lg bg-mist p-3">
            <button className={`${ghost} w-full bg-paper`} disabled={busy} onClick={() => run(() => api(`/api/wants/${w.id}/listings`, "POST"))}>
              Find real listings
            </button>
            <p className="mt-2 text-[13px] text-muted">Real stores and prices from Channel3. The haggling is simulated.</p>
          </div>
        )}
      </section>

      {bundles.length > 0 && (
        <section aria-label="Bundle" className="space-y-2">
          <h3 className="text-sm font-semibold">Bundle</h3>
          <select
            className={input}
            aria-label="Bundle"
            value={w.bundleId ?? ""}
            disabled={busy}
            onChange={(e) => run(() => api(`/api/wants/${w.id}/bundle`, "POST", { bundleId: e.target.value || null }))}
          >
            <option value="">No bundle (own budget)</option>
            {bundles.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({usd(b.total - b.spent)} left)</option>
            ))}
          </select>
          <p className="text-[13px] text-muted">A bundle shares one total budget between several wants.</p>
        </section>
      )}

      <section aria-label="Delete" className="border-t border-line pt-5">
        <button
          className="rounded-lg px-3 py-2 text-sm font-semibold text-scam transition-colors [@media(hover:hover)]:hover:bg-scam/10"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Delete "${w.item}" and its negotiations?`)) return;
            await run(() => api(`/api/wants/${w.id}`, "DELETE"));
            onDeleted();
          }}
        >
          Delete want
        </button>
        <p className="mt-1 text-[13px] text-muted">Removes the want, its sellers, conversations and deals.</p>
      </section>
    </div>
  );
}
