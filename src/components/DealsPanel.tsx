"use client";
import { useState } from "react";
import type { Deal, WantRecord } from "@/server/repo";
import { api } from "./api";
import { usd } from "./format";
import { PayPalCheckout } from "./PayPalCheckout";

const LABEL: Record<Deal["status"], string> = {
  awaiting_payment: "Ready to pay",
  order_created: "Payment in progress",
  paid: "Paid",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export function DealsPanel(props: {
  deals: Deal[];
  wants: WantRecord[];
  paypalClientId: string | null;
  buyerEmail?: string | null;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { deals, wants, paypalClientId, buyerEmail, onChanged, onError } = props;
  const [paying, setPaying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  const refund = async (dealId: string) => {
    setRefunding(true);
    try {
      await api(`/api/deals/${dealId}/refund`, "POST");
      setConfirming(null);
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefunding(false);
    }
  };
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
                <div className="pt-2">
                  {confirming === d.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Refund {usd(d.price)} to the buyer?</span>
                      <button className="rounded-md bg-scam px-3 py-1.5 font-medium text-white disabled:opacity-50" disabled={refunding} onClick={() => void refund(d.id)}>
                        {refunding ? "Refunding…" : "Yes, refund"}
                      </button>
                      <button className="rounded-md border border-line px-3 py-1.5 hover:border-ink" disabled={refunding} onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className="rounded-md border border-line px-3 py-1.5 font-medium hover:border-ink" onClick={() => setConfirming(d.id)}>
                      Refund {usd(d.price)}
                    </button>
                  )}
                </div>
              </dl>
            )}

            {d.status === "refunded" && (
              <p className="mt-3 border-t border-dashed border-line pt-3 text-sm">
                Refunded in full through PayPal. The want is open again, so you can negotiate it again.
              </p>
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
