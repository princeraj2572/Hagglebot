"use client";
import { useState } from "react";
import type { Deal, WantRecord } from "@/server/repo";
import { usd } from "./format";
import { PayPalCheckout } from "./PayPalCheckout";

const LABEL: Record<Deal["status"], string> = {
  awaiting_payment: "Ready to pay",
  order_created: "Payment in progress",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function DealsPanel(props: {
  deals: Deal[];
  wants: WantRecord[];
  paypalClientId: string | null;
  onChanged: () => void;
}) {
  const { deals, wants, paypalClientId, onChanged } = props;
  const [paying, setPaying] = useState<string | null>(null);
  const wantName = (id: string) => wants.find((w) => w.id === id)?.item ?? "Item";

  return (
    <section aria-label="Deals and payments" className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Deals &amp; payments</h2>
      <p className="rounded-md border border-navy-800 bg-navy-900 px-3 py-2 text-xs text-slate-400">
        PayPal <strong className="text-slate-200">sandbox</strong> only. No real money moves.
      </p>
      {deals.length === 0 && <p className="text-sm text-slate-500">Deals appear here when a seller agrees to a price within budget.</p>}

      <ul className="space-y-3">
        {deals.map((d) => (
          <li key={d.id} className={`rounded-lg border bg-navy-900 p-4 ${d.status === "paid" ? "border-accent" : "border-navy-800"}`} data-testid={`deal-${d.sellerName}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-100">{wantName(d.wantId)}</p>
                <p className="text-xs text-slate-400">from {d.sellerName}</p>
              </div>
              <span className="text-lg font-semibold text-accent">{usd(d.price)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{LABEL[d.status]}</p>

            {d.status === "paid" && (
              <dl className="mt-2 space-y-0.5 text-xs text-slate-400">
                <div>PayPal payer-id: <span className="font-mono text-slate-200">{d.payerId ?? "n/a"}</span></div>
                <div>Capture: <span className="font-mono text-slate-200">{d.captureId ?? "n/a"}</span></div>
                <div className="text-accent">Confirmation sent to the seller</div>
              </dl>
            )}

            {(d.status === "awaiting_payment" || d.status === "order_created") && (
              <div className="mt-3">
                {paying === d.id && paypalClientId ? (
                  <PayPalCheckout dealId={d.id} clientId={paypalClientId} onPaid={() => { setPaying(null); onChanged(); }} />
                ) : (
                  <button
                    className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-navy-950 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!paypalClientId}
                    onClick={() => setPaying(d.id)}
                  >
                    Confirm and Pay {usd(d.price)}
                  </button>
                )}
                {!paypalClientId && (
                  <p className="mt-2 text-xs text-slate-500">
                    PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env.local and restart.
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
