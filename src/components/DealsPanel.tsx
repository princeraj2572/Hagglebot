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
  buyerEmail?: string | null;
  onChanged: () => void;
}) {
  const { deals, wants, paypalClientId, buyerEmail, onChanged } = props;
  const [paying, setPaying] = useState<string | null>(null);
  const wantName = (id: string) => wants.find((w) => w.id === id)?.item ?? "Item";

  return (
    <section aria-label="Deals and payments" className="space-y-4">
      <h2 className="text-xl font-semibold">Deals</h2>
      <p className="text-sm text-muted">
        PayPal sandbox only. No real money moves.
        {buyerEmail && <> Log in as the sandbox buyer <span className="font-medium text-ink">{buyerEmail}</span>.</>}
      </p>
      {deals.length === 0 && <p className="text-sm text-muted">A deal shows up here when a seller agrees to a price within budget.</p>}

      <ul className="space-y-4">
        {deals.map((d) => (
          <li
            key={d.id}
            className="rounded-sm border border-dashed border-ink/60 bg-paper p-4"
            data-testid={`deal-${d.sellerName}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold">{wantName(d.wantId)}</p>
              <span className="num text-2xl font-bold">{usd(d.price)}</span>
            </div>
            <p className="text-sm text-muted">from {d.sellerName} · {LABEL[d.status]}</p>

            {d.status === "paid" && (
              <dl className="mt-3 space-y-0.5 border-t border-dashed border-line pt-3 text-sm">
                <div>PayPal payer-id <span className="num font-medium">{d.payerId ?? "n/a"}</span></div>
                <div>Capture <span className="num font-medium">{d.captureId ?? "n/a"}</span></div>
                <div className="text-ultra">Confirmation sent to the seller</div>
              </dl>
            )}

            {(d.status === "awaiting_payment" || d.status === "order_created") && (
              <div className="mt-3">
                {paying === d.id && paypalClientId ? (
                  <PayPalCheckout dealId={d.id} clientId={paypalClientId} onPaid={() => { setPaying(null); onChanged(); }} />
                ) : (
                  <button
                    className="w-full rounded-md bg-ultra px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2335b8] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!paypalClientId}
                    onClick={() => setPaying(d.id)}
                  >
                    Confirm and Pay {usd(d.price)}
                  </button>
                )}
                {!paypalClientId && (
                  <p className="mt-2 text-sm text-muted">
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
