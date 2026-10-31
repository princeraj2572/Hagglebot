"use client";
import { useState } from "react";
import { PERSONAS } from "@/lib/sellers/personas";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { usd } from "./format";

type Want = DashboardState["wants"][number];

const input =
  "w-full rounded-md border border-navy-800 bg-navy-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const btn =
  "rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-accent text-navy-950 hover:brightness-110`;
const ghost = `${btn} border border-navy-800 text-slate-200 hover:border-accent/60`;

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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Wishlist</h2>
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
        className="space-y-3 rounded-lg border border-navy-800 bg-navy-900 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const w = await api<{ id: string }>("/api/wants", "POST", { ...form, maxPrice: form.maxPrice });
            setForm({ ...form, item: "", maxPrice: "", notes: "" });
            onSelect(w.id);
          });
        }}
      >
        <h3 className="text-sm font-medium text-slate-200">New want</h3>
        <label className="block text-xs text-slate-400">
          Item
          <input className={`${input} mt-1`} required maxLength={120} value={form.item} placeholder="e.g. Sony WH-1000XM5"
            onChange={(e) => setForm({ ...form, item: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">
            Max price (USD)
            <input className={`${input} mt-1`} required inputMode="numeric" pattern="[0-9]*" value={form.maxPrice} placeholder="250"
              onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
          </label>
          <label className="block text-xs text-slate-400">
            Your name
            <input className={`${input} mt-1`} required maxLength={60} value={form.buyerName} placeholder="Alex"
              onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
          </label>
        </div>
        <label className="block text-xs text-slate-400">
          Notes
          <textarea className={`${input} mt-1`} rows={2} maxLength={500} value={form.notes} placeholder="prefer black, must ship this week"
            onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
        <button className={`${primary} w-full`} disabled={busy} type="submit">
          Add want
        </button>
      </form>

      {wants.length === 0 && <p className="text-sm text-slate-500">No wants yet. Add one, or load the demo scenario.</p>}

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
    <div className={`rounded-lg border bg-navy-900 p-4 ${selected ? "border-accent" : "border-navy-800"}`}>
      <button className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" onClick={onSelect} aria-pressed={selected}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-slate-100">{w.item}</span>
          <span className="shrink-0 text-sm text-accent">max {usd(w.maxPrice)}</span>
        </div>
        {w.notes && <p className="mt-1 text-xs text-slate-400">{w.notes}</p>}
        <p className="mt-1 text-xs text-slate-500">
          {w.status === "purchased" ? "Purchased" : `${w.sellers.length} seller${w.sellers.length === 1 ? "" : "s"}`}
        </p>
      </button>

      {selected && (
        <div className="mt-3 space-y-2 border-t border-navy-800 pt-3">
          <ul className="space-y-1">
            {w.sellers.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-xs text-slate-300">
                <span>{s.name} <span className="text-slate-500">· {s.endpoint}</span></span>
                <button className="text-slate-500 hover:text-rose-300" aria-label={`Remove ${s.name}`}
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
          <button className="text-xs text-slate-500 hover:text-rose-300"
            onClick={() => { if (confirm(`Delete "${w.item}" and its negotiations?`)) void run(() => api(`/api/wants/${w.id}`, "DELETE")); }}>
            Delete want
          </button>
        </div>
      )}
    </div>
  );
}
