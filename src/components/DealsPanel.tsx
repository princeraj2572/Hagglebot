"use client";
import { useState } from "react";
import type { Deal, WantRecord } from "@/server/repo";
import { api } from "./api";
import { Avatar } from "./Avatar";
import { usd } from "./format";
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
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const { deals, wants, onChanged, onError } = props;
  const [confirming, setConfirming] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const pay = async (dealId: string) => {
    setPaying(dealId);
    try {
      await new Promise((r) => setTimeout(r, 700)); // a beat, so it reads as a payment going through
      await api(`/api/deals/${dealId}/pay`, "POST");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setPaying(null);
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
        <span className="inline-flex items-center gap-2 rounded-md bg-mist px-3 py-1 text-[13px]">
          <span aria-hidden className="h-2 w-2 rounded-full bg-ink/40" />
          Mock payments. No real money moves.
        </span>
      </p>

      {deals.length === 0 && (
        <div className="max-w-sm rounded-xl bg-paper p-5 text-sm text-muted">
          <p className="font-semibold text-ink">Your receipt appears here</p>
          <p className="mt-1">When a seller agrees to a price within budget, the deal shows up with a Confirm and Pay button.</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {deals.map((d) => (
          <li
            key={d.id}
            className={`min-w-0 rounded-xl bg-paper p-5 shadow-lift ${d.status === "paid" ? "ring-1 ring-ultra/40" : ""}`}
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
                <span className="inline-flex items-center gap-1 rounded-md bg-[#E7F7EE] px-2.5 py-0.5 text-[13px] font-medium text-[#15803D]">
                  <span aria-hidden>✓</span> {LABEL[d.status]}
                </span>
              ) : (
                LABEL[d.status]
              )}
              {cheapest !== null && d.price === cheapest && d.status !== "cancelled" && d.status !== "refunded" && (
                <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[13px] font-medium text-[#92400E]">Best price</span>
              )}
            </p>

            {d.status === "paid" && (
              <dl className="mt-4 space-y-1 border-t border-dashed border-ink/25 pt-4 text-sm">
                <div className="break-words"><span className="text-muted">Payer</span> <span className="num break-all font-semibold">{d.payerId ?? "n/a"}</span></div>
                <div className="break-words"><span className="text-muted">Payment</span> <span className="num break-all font-semibold">{d.captureId ?? "n/a"}</span></div>
                <div className="text-ultra">Confirmation sent to the seller</div>
                <div className="pt-2">
                  {confirming === d.id ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Ask {d.sellerName} to refund {usd(d.price)}?</span>
                      <button className={`${btn} bg-scam text-white`} disabled={refunding} onClick={() => void refund(d.id)}>
                        {refunding ? `Waiting for ${d.sellerName}…` : "Yes, request refund"}
                      </button>
                      <button className={`${btn} border border-line bg-paper [@media(hover:hover)]:hover:bg-mist`} disabled={refunding} onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button className={`${btn} border border-line bg-paper [@media(hover:hover)]:hover:bg-mist`} onClick={() => setConfirming(d.id)}>
                      Request refund of {usd(d.price)}
                    </button>
                  )}
                  <p className="mt-1 text-[13px] text-muted">Simulation: the simulated seller always approves. Nothing real was charged, so nothing real is refunded.</p>
                </div>
              </dl>
            )}

            {d.status === "refunded" && (
              <p className="mt-4 border-t border-dashed border-ink/25 pt-4 text-sm">
                {d.sellerName} approved the refund (mock: nothing real was charged). The want is open again, so you can negotiate it again.
              </p>
            )}

            {(d.status === "awaiting_payment" || d.status === "order_created") && (
              <div className="mt-3">
                <button
                  className={`${btn} w-full bg-ink py-2.5 text-white [@media(hover:hover)]:hover:bg-[#2A2A2A]`}
                  disabled={paying !== null}
                  onClick={() => void pay(d.id)}
                >
                  {paying === d.id ? "Paying…" : `Confirm and Pay ${usd(d.price)}`}
                </button>
                <p className="mt-2 text-sm text-muted">Mock payment: no real money moves. The proof of payment is labelled MOCK.</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
