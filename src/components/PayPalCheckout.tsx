"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

interface PayPalButtons {
  render(el: HTMLElement): Promise<void>;
  close(): Promise<void>;
}
interface PayPalNamespace {
  Buttons(opts: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }): PayPalButtons;
}
declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let sdkPromise: Promise<PayPalNamespace> | null = null;

/** Loads the PayPal JS SDK once. A sandbox client-id makes it run in the sandbox. */
function loadSdk(clientId: string): Promise<PayPalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  sdkPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&disable-funding=card`;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK did not initialise")));
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("Could not load the PayPal SDK (is www.paypal.com reachable?)"));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/** Orders v2 in the browser: create (our API) -> buyer approves in PayPal's popup -> capture (our API). */
export function PayPalCheckout({ dealId, clientId, onPaid }: { dealId: string; clientId: string; onPaid: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  // The parent passes a new onPaid every render (the page polls every second). Keeping it in a ref stops the
  // effect below from tearing down PayPal's popup mid-login.
  const paid = useRef(onPaid);
  paid.current = onPaid;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let buttons: PayPalButtons | null = null;
    let cancelled = false;
    loadSdk(clientId)
      .then(async (paypal) => {
        if (cancelled || !box.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay" },
          createOrder: async () => (await api<{ orderId: string }>(`/api/deals/${dealId}/order`, "POST")).orderId,
          onApprove: async (data) => {
            try {
              await api(`/api/orders/${data.orderID}/capture`, "POST");
              paid.current();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          },
          onCancel: () => setError("Payment cancelled. You can try again."),
          onError: (e) => setError(e instanceof Error ? e.message : "PayPal reported an error"),
        });
        await buttons.render(box.current);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setLoading(false);
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      void buttons?.close().catch(() => undefined);
    };
  }, [dealId, clientId]);

  return (
    <div className="mt-3">
      {loading && <p className="text-xs text-muted">Loading PayPal sandbox checkout…</p>}
      <div ref={box} />
      {error && (
        <p role="alert" className="mt-2 text-xs text-scam">
          {error}
        </p>
      )}
    </div>
  );
}
