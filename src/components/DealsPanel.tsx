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
  /** ?demo=1: pay with a labelled mock instead of the PayPal popup. */
  demo?: boolean;
  buyerEmail?: string | null;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { deals, wants, paypalClientId, buyerEmail, onChanged, onError, demo = false } = props;
  const [paying, setPaying] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [demoPaying, setDemoPaying] = useState<string | null>(null);

  const demoPay = async (dealId: string) => {
    setDemoPaying(dealId);
    try {
      await new Promise((r) => setTimeout(r, 700)); // a beat, so it reads as a payment going through
      await api(`/api/deals/${dealId}/demo-pay`, "POST");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setDemoPaying(null);
    }
  };

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
        <span className="inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 text-[13px]">
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
        <div className="max-w-sm rounded-2xl bg-paper p-5 text-sm text-muted">
          <p className="font-semibold text-ink">Your receipt appears here</p>
          <p className="mt-1">When a seller agrees to a price within budget, the deal shows up with a Confirm and Pay button.</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {deals.map((d) => (
          <li
            key={d.id}
            className={`min-w-0 rounded-2xl bg-paper p-5 shadow-lift ${d.status === "paid" ? "ring-1 ring-ultra/40" : ""}`}
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
              <span className="num shrink-0 text-3xl font-bold tracking-tight">{usd(d.price)}</span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {d.status === "paid" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ultra px-2.5 py-0.5 text-[13px] font-semibold text-white">
                  <span aria-hidden>✓</span> {LABEL[d.status]}
                </span>
              ) : (
                LABEL[d.status]
              )}
              {cheapest !== null && d.price === cheapest && d.status !== "cancelled" && d.status !== "refunded" && (
                <span className="rounded-full bg-tag px-2 py-0.5 text-[13px] font-semibold text-ink">Best price</span>
              )}
            </p>

            {d.status === "paid" && (
              <dl className="mt-4 space-y-1 border-t border-dashed border-ink/25 pt-4 text-sm">
                <div className="break-words"><span className="text-muted">PayPal payer-id</span> <span className="num break-all font-semibold">{d.payerId ?? "n/a"}</span></div>
                <div className="break-words"><span className="text-muted">Capture</span> <span className="num break-all font-semibold">{d.captureId ?? "n/a"}</span></div>
                <div className="text-ultra">Confirmation sent to the seller</div>
                <div className="pt-2">
                  {confirming === d.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Ask {d.sellerName} to refund {usd(d.price)}?</span>
                      <button className={`${btn} bg-scam text-white`} disabled={refunding} onClick={() => void refund(d.id)}>
                        {refunding ? `Waiting for ${d.sellerName}…` : "Yes, request refund"}
                      </button>
                      <button className={`${btn} bg-mist [@media(hover:hover)]:hover:bg-[#DCE2EF]`} disabled={refunding} onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className={`${btn} bg-mist [@media(hover:hover)]:hover:bg-[#DCE2EF]`} onClick={() => setConfirming(d.id)}>
                      Request refund of {usd(d.price)}
                    </button>
                  )}
                  <p className="mt-1 text-[13px] text-muted">{d.captureId?.startsWith("DEMO-") ? "Demo: the simulated seller always approves. No PayPal payment was made, so nothing is refunded there." : "Demo: the simulated seller always approves, then PayPal's refund call runs. In real life the seller issues the refund."}</p>
                </div>
              </dl>
            )}

            {d.status === "refunded" && (
              <p className="mt-4 border-t border-dashed border-ink/25 pt-4 text-sm">
                {d.sellerName} approved the refund{d.captureId?.startsWith("DEMO-") ? " (demo: no PayPal payment was made)" : ", and it was paid back in full through PayPal"}. The want is open again, so you can negotiate it again.
              </p>
            )}

            {(d.status === "awaiting_payment" || d.status === "order_created") && (
              <div className="mt-3">
                {demo ? (
                  <>
                    <button
                      className={`${btn} w-full bg-ultra py-2.5 font-semibold text-white [@media(hover:hover)]:hover:bg-[#2335b8]`}
                      disabled={demoPaying !== null}
                      onClick={() => void demoPay(d.id)}
                    >
                      {demoPaying === d.id ? "Paying…" : `Confirm and Pay ${usd(d.price)} (demo)`}
                    </button>
                    <p className="mt-2 text-sm text-muted">Demo mode: no PayPal payment is made. The proof of payment is labelled DEMO.</p>
                  </>
                ) : paying === d.id && paypalClientId ? (
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
                {!demo && !paypalClientId && (
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
