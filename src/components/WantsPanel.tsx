"use client";
import { useState } from "react";
import { STYLE_INFO } from "@/lib/negotiation/strategy";
import { NEGOTIATION_STYLES, type NegotiationStyle } from "@/lib/negotiation/types";
import { PERSONAS } from "@/lib/sellers/personas";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { Avatar, tagline } from "./Avatar";
import { usd } from "./format";
import { ghost, input, primary } from "./ui";

type Want = DashboardState["wants"][number];

export function WantsPanel(props: {
  wants: Want[];
  selectedId: string | null;
  listings: boolean;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { wants, selectedId, listings, onSelect, onChanged, onError } = props;
  const [form, setForm] = useState<{ item: string; maxPrice: string; notes: string; buyerName: string; style: NegotiationStyle }>({
    item: "", maxPrice: "", notes: "", buyerName: "", style: "balanced",
  });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const formOpen = showForm || wants.length === 0;

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
    <section aria-label="Wants" className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Wants</h2>
        {wants.length > 0 && (
          <button className={`${ghost} py-1.5`} aria-expanded={formOpen} onClick={() => setShowForm((v) => !v)}>
            {formOpen ? "Close" : "New want"}
          </button>
        )}
      </div>

      {formOpen && (
        <form
          className="space-y-3 rounded-md border border-line bg-paper p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const w = await api<{ id: string }>("/api/wants", "POST", { ...form, maxPrice: form.maxPrice });
              setForm({ ...form, item: "", maxPrice: "", notes: "" });
              setShowForm(false);
              onSelect(w.id);
            });
          }}
        >
          <label className="block text-[13px] text-muted">
            What do you want?
            <input className={`${input} mt-1`} required maxLength={120} value={form.item} placeholder="e.g. Wireless noise-cancelling headphones"
              onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[13px] text-muted">
              Max price (USD)
              <input className={`${input} mt-1`} required inputMode="numeric" pattern="[0-9]*" value={form.maxPrice} placeholder="250"
                onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
            </label>
            <label className="block text-[13px] text-muted">
              Your name
              <input className={`${input} mt-1`} required maxLength={60} value={form.buyerName} placeholder="Alex"
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
            </label>
          </div>
          <label className="block text-[13px] text-muted">
            Notes for the sellers
            <textarea className={`${input} mt-1`} rows={2} maxLength={500} value={form.notes} placeholder="prefer black, must ship this week"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] text-muted">How hard should it haggle?</legend>
            {NEGOTIATION_STYLES.map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors duration-150 ${
                  form.style === s ? "border-ultra bg-ultra/5" : "border-line [@media(hover:hover)]:hover:border-ink/40"
                }`}
              >
                <input type="radio" name="style" value={s} checked={form.style === s} onChange={() => setForm({ ...form, style: s })} className="mt-1 accent-[#2B3FD6]" />
                <span>
                  <b className="font-semibold">{STYLE_INFO[s].label}</b>
                  <span className="block text-[13px] text-muted">{STYLE_INFO[s].description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button className={`${primary} w-full`} disabled={busy} type="submit">
            Add want
          </button>
        </form>
      )}

      {wants.length === 0 && <p className="text-sm text-muted">No wants yet. Add one above, or load the demo scenario.</p>}

      <ul className="space-y-2">
        {wants.map((w) => (
          <li key={w.id}>
            <WantCard want={w} selected={w.id === selectedId} listings={listings} onSelect={() => onSelect(w.id)} run={run} />
          </li>
        ))}
      </ul>

      <button
        className="rounded-md py-1 text-sm font-medium text-ultra underline-offset-4 hover:underline disabled:opacity-50"
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
    </section>
  );
}

function WantCard({ want: w, selected, listings, onSelect, run }: {
  want: Want; selected: boolean; listings: boolean; onSelect: () => void; run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [persona, setPersona] = useState(PERSONAS[0]?.id ?? "ferdi");
  return (
    <div className={`rounded-md border p-3 ${selected ? "border-ultra bg-paper shadow-[0_0_0_1px_#2B3FD6]" : "border-line bg-paper/60"}`}>
      <button className="block w-full min-w-0 text-left" onClick={onSelect} aria-pressed={selected}>
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 break-words font-semibold leading-snug">{w.item}</span>
          <span className="num shrink-0 text-sm font-semibold">{usd(w.maxPrice)}</span>
        </span>
        {w.notes && <span className="mt-1 block break-words text-[13px] text-muted">{w.notes}</span>}
        <span className="mt-1 block text-[13px] text-muted">
          {w.status === "purchased" ? "Purchased" : `${w.sellers.length} seller${w.sellers.length === 1 ? "" : "s"}`}
          {" · "}
          {STYLE_INFO[w.style ?? "balanced"].label}
        </span>
      </button>

      {selected && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <ul className="space-y-1.5">
            {w.sellers.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <Avatar name={s.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium leading-tight">{s.name}</span>
                  <span className="block text-[13px] text-muted">{tagline(s.name)}</span>
                </span>
                <button className="shrink-0 rounded px-1 text-muted [@media(hover:hover)]:hover:text-scam" aria-label={`Remove ${s.name}`}
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
          {listings && (
            <div>
              <button className={`${ghost} w-full`} onClick={() => run(() => api(`/api/wants/${w.id}/listings`, "POST"))}>
                Find real listings
              </button>
              <p className="mt-1 text-[13px] text-muted">Real stores and prices from Channel3. The haggling is simulated.</p>
            </div>
          )}
          <button className="rounded py-1 text-sm text-muted [@media(hover:hover)]:hover:text-scam"
            onClick={() => { if (confirm(`Delete "${w.item}" and its negotiations?`)) void run(() => api(`/api/wants/${w.id}`, "DELETE")); }}>
            Delete want
          </button>
        </div>
      )}
    </div>
  );
}
