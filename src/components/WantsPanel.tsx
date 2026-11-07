"use client";
import { useEffect, useState } from "react";
import { STYLE_INFO } from "@/lib/negotiation/strategy";
import { NEGOTIATION_STYLES, type NegotiationStyle, type Thread } from "@/lib/negotiation/types";
import type { Deal } from "@/server/repo";
import type { DashboardState } from "@/server/state";
import { api } from "./api";
import { usd } from "./format";
import { Modal } from "./Modal";
import { input, primary, ghost } from "./ui";

type Want = DashboardState["wants"][number];
type Bundle = DashboardState["bundles"][number];

/** Where a want stands, in a few words, so the list can be scanned without opening anything. */
function statusOf(w: Want, threads: Thread[], deals: Deal[]): { text: string; dot: string } {
  if (w.status === "purchased") return { text: "Purchased", dot: "bg-ink" };
  const mine = threads.filter((t) => t.wantId === w.id);
  const live = mine.filter((t) => t.status === "negotiating").length;
  if (live > 0) return { text: `Haggling · ${live} of ${mine.length} live`, dot: "bg-ultra motion-safe:animate-pulse" };
  if (mine.some((t) => t.status === "awaiting_approval")) return { text: "Needs your approval", dot: "bg-tag" };
  const ready = deals.filter((d) => d.wantId === w.id && (d.status === "awaiting_payment" || d.status === "order_created")).length;
  if (ready > 0) return { text: `${ready} deal${ready === 1 ? "" : "s"} ready to pay`, dot: "bg-ultra" };
  if (mine.length > 0) return { text: "No deal yet", dot: "bg-muted/50" };
  if (w.sellers.length === 0) return { text: "No sellers yet", dot: "bg-muted/40" };
  return { text: `Ready · ${w.sellers.length} seller${w.sellers.length === 1 ? "" : "s"}`, dot: "bg-tag" };
}

export function WantsPanel(props: {
  wants: Want[];
  bundles: Bundle[];
  threads: Thread[];
  deals: Deal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
  onError: (msg: string) => void;
  /** Find sellers for a new want and negotiate, without further clicks. */
  onAutopilot?: (wantId: string) => void;
  /** Increases each time something else asks for the New want dialog to open. */
  openNewWant?: number;
  /** Fills the New want form when it is opened from a ready-made example. */
  preset?: { item: string; maxPrice: string; notes: string } | null;
}) {
  const { wants, bundles, threads, deals, selectedId, onSelect, onChanged, onError, onAutopilot, openNewWant = 0, preset = null } = props;
  const [autopilot, setAutopilot] = useState(true);
  const [form, setForm] = useState<{ item: string; maxPrice: string; notes: string; buyerName: string; style: NegotiationStyle; requireApproval: boolean }>({
    item: "", maxPrice: "", notes: "", buyerName: "", style: "balanced", requireApproval: false,
  });
  const [bundleForm, setBundleForm] = useState({ name: "", total: "" });
  const [dialog, setDialog] = useState<"want" | "bundle" | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (openNewWant > 0) {
      if (preset) setForm((f) => ({ ...f, ...preset }));
      setDialog("want");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewWant]);

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
    <section aria-label="Wants" className="min-w-0 space-y-6">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-lg font-bold tracking-tight">Wants</h2>
          {wants.length > 0 && <span className="num text-sm text-muted">{wants.length}</span>}
        </div>
        <button className={`${primary} w-full py-2.5 text-base`} onClick={() => setDialog("want")}>
          New want
        </button>
      </div>

      {wants.length === 0 && (
        <p className="px-1 text-sm leading-relaxed text-muted">
          A want is something you would like to buy, and the most you will pay for it. Hagglebot does the haggling.
        </p>
      )}

      <ul className="-mx-1 space-y-0.5">
        {wants.map((w) => {
          const selected = w.id === selectedId;
          const st = statusOf(w, threads, deals);
          const bundle = w.bundleId ? bundles.find((b) => b.id === w.bundleId) : undefined;
          return (
            <li key={w.id}>
              <button
                onClick={() => onSelect(w.id)}
                aria-pressed={selected}
                className={`relative flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition-[background-color,box-shadow] duration-150 ${
                  selected
                    ? "bg-paper shadow-lift before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-full before:bg-ultra"
                    : "[@media(hover:hover)]:hover:bg-paper/60"
                }`}
              >
                <i aria-hidden className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 min-w-0 break-words font-semibold leading-snug" title={w.item}>{w.item}</span>
                    <span className="num shrink-0 text-sm font-semibold text-muted">{usd(w.maxPrice)}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted">{st.text}</span>
                  {bundle && <span className="mt-0.5 block truncate text-[13px] text-muted">Bundle: {bundle.name}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h3 className="text-sm font-semibold">Bundles</h3>
          <button className="rounded py-0.5 text-sm font-semibold text-ultra underline-offset-4 hover:underline" onClick={() => setDialog("bundle")}>
            New bundle
          </button>
        </div>
        {bundles.length === 0 ? (
          <p className="px-1 text-[13px] leading-relaxed text-muted">Share one total budget between several wants, for example a whole desk setup.</p>
        ) : (
          <ul className="space-y-1.5">
            {bundles.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.total) * 100));
              return (
                <li key={b.id} className="rounded-lg bg-paper px-3 py-2.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-semibold leading-tight">{b.name}</span>
                    <button
                      className="-mr-1 -mt-0.5 shrink-0 rounded-full p-1 text-muted transition-colors [@media(hover:hover)]:hover:bg-mist [@media(hover:hover)]:hover:text-scam"
                      aria-label={`Delete bundle ${b.name}`}
                      onClick={() => run(() => api(`/api/bundles/${b.id}`, "DELETE"))}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist" role="img" aria-label={`${pct}% of the bundle budget spent`}>
                    <div className="h-full rounded-full bg-ultra" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="num mt-1.5 text-[13px] text-muted">{usd(b.spent)} of {usd(b.total)} spent</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal open={dialog === "want"} onClose={() => setDialog(null)} title="New want">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const w = await api<{ id: string }>("/api/wants", "POST", { ...form, maxPrice: form.maxPrice });
              setForm({ ...form, item: "", maxPrice: "", notes: "" });
              setDialog(null);
              onSelect(w.id);
              if (autopilot) onAutopilot?.(w.id);
            });
          }}
        >
          <label className="block text-sm font-medium">
            What do you want?
            <input className={`${input} mt-1.5`} required maxLength={120} value={form.item} placeholder="e.g. Wireless noise-cancelling headphones"
              onChange={(e) => setForm({ ...form, item: e.target.value })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              The most you will pay (USD)
              <input className={`${input} mt-1.5`} required inputMode="numeric" pattern="[0-9]*" value={form.maxPrice} placeholder="250"
                onChange={(e) => setForm({ ...form, maxPrice: e.target.value })} />
              <span className="mt-1 block text-[13px] font-normal text-muted">Never shown to sellers, never exceeded.</span>
            </label>
            <label className="block text-sm font-medium">
              Your name
              <input className={`${input} mt-1.5`} required maxLength={60} value={form.buyerName} placeholder="Alex"
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })} />
              <span className="mt-1 block text-[13px] font-normal text-muted">Used when Hagglebot introduces itself.</span>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Notes for the sellers <span className="font-normal text-muted">(optional)</span>
            <textarea className={`${input} mt-1.5`} rows={2} maxLength={500} value={form.notes} placeholder="prefer black, must ship this week"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>

          <fieldset>
            <legend className="text-sm font-medium">How hard should it haggle?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {NEGOTIATION_STYLES.map((s) => (
                <label
                  key={s}
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border-2 px-3 py-2.5 text-sm transition-colors duration-150 ${
                    form.style === s ? "border-ultra bg-ultra/5" : "border-transparent bg-mist [@media(hover:hover)]:hover:bg-[#E4E5E9]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="style" value={s} checked={form.style === s} onChange={() => setForm({ ...form, style: s })} className="accent-[#3B4CDD]" />
                    <b className="font-semibold">{STYLE_INFO[s].label}</b>
                  </span>
                  <span className="text-[13px] leading-snug text-muted">{STYLE_INFO[s].description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-ultra/10 px-3 py-3 text-sm">
            <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} className="mt-1 accent-[#3B4CDD]" />
            <span>
              <span className="font-semibold">Find sellers and negotiate for me</span>
              <span className="block text-[13px] text-muted">
                Hagglebot searches the marketplace for this item, adds the best matches as sellers and starts negotiating. Untick to choose the sellers yourself.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-mist px-3 py-3 text-sm">
            <input type="checkbox" checked={form.requireApproval} onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })} className="mt-1 accent-[#3B4CDD]" />
            <span>
              <span className="font-medium">Ask me before accepting a price</span>
              <span className="block text-[13px] text-muted">Hagglebot stops at an in-budget price and waits for your OK.</span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={ghost} onClick={() => setDialog(null)}>Cancel</button>
            <button className={primary} disabled={busy} type="submit">Add want</button>
          </div>
        </form>
      </Modal>

      <Modal open={dialog === "bundle"} onClose={() => setDialog(null)} title="New bundle">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("/api/bundles", "POST", { name: bundleForm.name, total: Number(bundleForm.total) });
              setBundleForm({ name: "", total: "" });
              setDialog(null);
            });
          }}
        >
          <p className="text-sm text-muted">A bundle shares one total budget between several wants. Hagglebot never pays more than the total across all of them.</p>
          <label className="block text-sm font-medium">
            Name
            <input className={`${input} mt-1.5`} required maxLength={60} value={bundleForm.name} placeholder="Desk setup" onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })} />
          </label>
          <label className="block text-sm font-medium">
            Total budget (USD)
            <input className={`${input} mt-1.5`} required inputMode="numeric" pattern="[0-9]*" value={bundleForm.total} placeholder="600" onChange={(e) => setBundleForm({ ...bundleForm, total: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className={ghost} onClick={() => setDialog(null)}>Cancel</button>
            <button className={primary} disabled={busy} type="submit">Add bundle</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
