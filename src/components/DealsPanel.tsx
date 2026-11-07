"use client";
import { useState } from "react";
import type { Deal, WantRecord } from "@/server/repo";
import { api } from "./api";
import { Avatar } from "./Avatar";
import { usd } from "./format";
import { PayPalCheckout } from "./PayPalCheckout";
import { btn } from "./ui";

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
      // The seller is simulated and always approves; a short wait lets the request read as a request.
      await new Promise((r) => setTimeout(r, 1500));
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
  const open = deals.filter((d) => d.status !== "cancelled" && d.status !== "refunded");
  const cheapest = open.length > 1 ? Math.min(...open.map((d) => d.price)) : null;

  return (
    <section aria-label="Deals and payments" className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[13px]">
          <span aria-hidden className="h-2 w-2 rounded-full bg-ink/40" />
          PayPal sandbox only. No real money moves.
        </span>
        {buyerEmail && (
          <span className="min-w-0 break-all">
            Sandbox buyer: <span className="font-medium text-ink">{buyerEmail}</span>
          </span>
        )}
      </p>

      {deals.length === 0 && (
        <div className="max-w-sm rounded-sm border border-dashed border-line bg-paper/60 p-5 text-sm text-muted">
          <p className="font-semibold text-ink">Your receipt appears here</p>
          <p className="mt-1">When a seller agrees to a price within budget, the deal shows up with a Confirm and Pay button.</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {deals.map((d) => (
          <li
            key={d.id}
            className="min-w-0 rounded-sm border border-dashed border-ink/60 bg-paper p-4"
            data-testid={`deal-${d.sellerName}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={d.sellerName} />
                <div className="min-w-0">
                  <p className="break-words font-semibold leading-tight">{d.sellerName}</p>
                  <p className="break-words text-sm text-muted">{wantName(d.wantId)}</p>
                </div>
              </div>
              <span className="num shrink-0 text-2xl font-bold">{usd(d.price)}</span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {LABEL[d.status]}
              {cheapest !== null && d.price === cheapest && d.status !== "cancelled" && d.status !== "refunded" && (
                <span className="rounded-full bg-tag px-2 py-0.5 text-[13px] font-semibold text-ink">Best price</span>
              )}
            </p>

            {d.status === "paid" && (
              <dl className="mt-3 space-y-0.5 border-t border-dashed border-line pt-3 text-sm">
                <div className="break-words">PayPal payer-id <span className="num break-all font-medium">{d.payerId ?? "n/a"}</span></div>
                <div className="break-words">Capture <span className="num break-all font-medium">{d.captureId ?? "n/a"}</span></div>
                <div className="text-ultra">Confirmation sent to the seller</div>
                <div className="pt-2">
                  {confirming === d.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Ask {d.sellerName} to refund {usd(d.price)}?</span>
                      <button className={`${btn} bg-scam text-white`} disabled={refunding} onClick={() => void refund(d.id)}>
                        {refunding ? `Waiting for ${d.sellerName}…` : "Yes, request refund"}
                      </button>
                      <button className={`${btn} border border-line [@media(hover:hover)]:hover:border-ink`} disabled={refunding} onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className={`${btn} border border-line [@media(hover:hover)]:hover:border-ink`} onClick={() => setConfirming(d.id)}>
                      Request refund of {usd(d.price)}
                    </button>
                  )}
                  <p className="mt-1 text-[13px] text-muted">Demo: the simulated seller always approves, then PayPal's refund call runs. In real life the seller issues the refund.</p>
                </div>
              </dl>
            )}

            {d.status === "refunded" && (
              <p className="mt-3 border-t border-dashed border-line pt-3 text-sm">
                {d.sellerName} approved the refund, and it was paid back in full through PayPal. The want is open again, so you can negotiate it again.
              </p>
            )}

            {(d.status === "awaiting_payment" || d.status === "order_created") && (
              <div className="mt-3">
                {paying === d.id && paypalClientId ? (
                  <PayPalCheckout dealId={d.id} clientId={paypalClientId} onPaid={() => { setPaying(null); onChanged(); }} />
                ) : (
                  <button
                    className={`${btn} w-full bg-ultra py-2.5 font-semibold text-white [@media(hover:hover)]:hover:bg-[#2335b8]`}
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
