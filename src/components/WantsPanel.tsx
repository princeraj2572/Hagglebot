"use client";
import { useState } from "react";
import { PERSONAS } from "@/lib/sellers/personas";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { usd } from "./format";

type Want = DashboardState["wants"][number];

const input =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm placeholder:text-muted/70 focus:border-ultra";
const btn =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-ultra text-white hover:bg-[#2335b8]`;
const ghost = `${btn} whitespace-nowrap border border-line hover:border-ink`;

export function WantsPanel(props: {
  wants: Want[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { wants, selectedId, onSelect, onChanged, onError } = props;
  const [form, setForm] = useState({ item: "", maxPrice: "", notes: "", buyerName: "" });
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

  return (
    <section aria-label="Wishlist" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Wishlist</h2>
        <button
          className={ghost}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await api<{ wantId: string }>("/api/demo", "POST");
              onSelect(r.wantId);
            })
          }
        >
          Load demo scenario
        </button>
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const w = await api<{ id: string }>("/api/wants", "POST", { ...form, maxPrice: form.maxPrice });
            setForm({ ...form, item: "", maxPrice: "", notes: "" });
            onSelect(w.id);
          });
        }}
      >
        <h3 className="text-sm font-semibold">New want</h3>
        <label className="block text-xs text-muted">
          Item
          <input className={`${input} mt-1`} required maxLength={120} value={form.item} placeholder="e.g. Wireless noise-cancelling headphones"
            onChange={(e) => setForm({ ...form, item: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-muted">
            Max price (USD)
            <input className={`${input} mt-1`} required inputMode="numeric" pattern="[0-9]*" value={form.maxPrice} placeholder="250"
              onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
          </label>
          <label className="block text-xs text-muted">
            Your name
            <input className={`${input} mt-1`} required maxLength={60} value={form.buyerName} placeholder="Alex"
              onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
          </label>
        </div>
        <label className="block text-xs text-muted">
          Notes
          <textarea className={`${input} mt-1`} rows={2} maxLength={500} value={form.notes} placeholder="prefer black, must ship this week"
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button className={`${primary} w-full`} disabled={busy} type="submit">
          Add want
        </button>
      </form>

      {wants.length === 0 && <p className="text-sm text-muted">No wants yet. Add one, or load the demo scenario.</p>}

      <ul className="space-y-3">
        {wants.map((w) => (
          <li key={w.id}>
            <WantCard want={w} selected={w.id === selectedId} onSelect={() => onSelect(w.id)} run={run} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function WantCard({ want: w, selected, onSelect, run }: {
  want: Want; selected: boolean; onSelect: () => void; run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [persona, setPersona] = useState(PERSONAS[0]?.id ?? "ferdi");
  return (
    <div className={`border-l-4 pl-3 ${selected ? "border-ultra" : "border-transparent"}`}>
      <button className="block w-full text-left" onClick={onSelect} aria-pressed={selected}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold">{w.item}</span>
          <span className="num shrink-0 text-sm font-semibold">max {usd(w.maxPrice)}</span>
        </div>
        {w.notes && <p className="mt-1 text-xs text-muted">{w.notes}</p>}
        <p className="mt-1 text-xs text-muted">
          {w.status === "purchased" ? "Purchased" : `${w.sellers.length} seller${w.sellers.length === 1 ? "" : "s"}`}
        </p>
      </button>

      {selected && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <ul className="space-y-1">
            {w.sellers.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.name} <span className="text-muted">· {s.endpoint}</span></span>
                <button className="text-muted hover:text-scam" aria-label={`Remove ${s.name}`}
                  onClick={() => run(() => api(`/api/sellers/${s.id}`, "DELETE"))}>
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
            <button className={ghost} onClick={() => run(() => api(`/api/wants/${w.id}/sellers`, "POST", { persona }))}>
              Add seller
            </button>
          </div>
          <button className="text-sm text-muted hover:text-scam"
            onClick={() => { if (confirm(`Delete "${w.item}" and its negotiations?`)) void run(() => api(`/api/wants/${w.id}`, "DELETE")); }}>
            Delete want
          </button>
        </div>
      )}
    </div>
  );
}
