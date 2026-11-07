import type { OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";
import { captureOrder, createOrder, PayPalError, refundCapture } from "../lib/paypal/orders";
import type { Deal, Repo } from "./repo";
import type { NegotiationRunner } from "./runner";

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "not_found" | "conflict" | "paypal",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export interface PaymentDeps {
  repo: Repo;
  runner: NegotiationRunner;
  /** null when PayPal sandbox credentials are not configured. */
  orders: OrdersController | null;
  /** Used for refunds; null when PayPal sandbox credentials are not configured. */
  paymentsApi?: PaymentsController | null;
  sellerEmail?: string | undefined;
  now?: () => number;
}

/** Orders v2 flow for a closed deal: create -> (buyer approves in popup) -> capture. */
export class PaymentService {
  constructor(private readonly d: PaymentDeps) {}

  private requireOrders(): OrdersController {
    if (!this.d.orders) {
      throw new PaymentError("PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local.", "not_configured");
    }
    return this.d.orders;
  }

  /** The amount always comes from our database, never from the browser. */
  async createOrderForDeal(dealId: string): Promise<{ orderId: string; deal: Deal }> {
    const orders = this.requireOrders();
    const { repo } = this.d;
    const deal = repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "paid" || deal.status === "refunded" || deal.status === "cancelled") {
      throw new PaymentError(`Deal is already ${deal.status}`, "conflict");
    }
    const want = repo.getWant(deal.wantId);
    if (!want || want.status !== "open") throw new PaymentError("This want has already been purchased", "conflict");
    try {
      const created = await createOrder(orders, {
        amount: deal.price.toFixed(2),
        description: `${want.item} from ${deal.sellerName} (Hagglebot)`,
        sellerEmail: this.d.sellerEmail,
        referenceId: deal.id,
      });
      repo.updateDeal(deal.id, { status: "order_created", paypalOrderId: created.orderId });
      return { orderId: created.orderId, deal: repo.getDeal(deal.id)! };
    } catch (err) {
      if (err instanceof PayPalError) throw new PaymentError(err.message, "paypal");
      throw err;
    }
  }

  /** Capture an approved order, record the payer-id, confirm to the seller, withdraw from the rest. */
  async captureForOrder(orderId: string): Promise<Deal> {
    const orders = this.requireOrders();
    const { repo } = this.d;
    const deal = repo.getDealByOrder(orderId);
    if (!deal) throw new PaymentError("Unknown order", "not_found");
    if (deal.status === "paid") return deal; // idempotent
    if (deal.status === "cancelled" || deal.status === "refunded") throw new PaymentError(`Deal was ${deal.status}`, "conflict");

    let cap;
    try {
      cap = await captureOrder(orders, orderId);
    } catch (err) {
      if (err instanceof PayPalError) throw new PaymentError(err.message, "paypal");
      throw err;
    }
    return this.settle(deal, {
      payerId: cap.payerId ?? null,
      payerEmail: cap.payerEmail ?? null,
      captureId: cap.captureId ?? null,
      proof: `Payment sent: $${deal.price} via PayPal. Proof of payment: PayPal payer-id ${cap.payerId ?? "n/a"}, capture ${cap.captureId ?? "n/a"} (order ${orderId}). Thanks for the smooth deal!`,
    });
  }

  /** Records a payment, confirms to the seller, marks the want bought and withdraws from the other sellers. */
  private settle(deal: Deal, paid: { payerId: string | null; payerEmail: string | null; captureId: string | null; proof: string }): Deal {
    const { repo } = this.d;
    repo.updateDeal(deal.id, { status: "paid", payerId: paid.payerId, payerEmail: paid.payerEmail, captureId: paid.captureId });

    const thread = repo.getThread(deal.threadId);
    const want = repo.getWant(deal.wantId);
    if (thread && want) {
      repo.addMessage(thread.id, {
        from: "buyer",
        at: (this.d.now ?? Date.now)(),
        price: deal.price,
        text: `${paid.proof} This message is from Hagglebot, an AI buyer agent acting for ${want.buyerName}.`,
      });
      repo.setWantStatus(want.id, "purchased");
      for (const other of repo.listThreads(want.id)) {
        if (other.id === thread.id) continue;
        this.d.runner.withdraw(other.id);
        const od = repo.listDeals(want.id).find((x) => x.threadId === other.id);
        if (od && od.status !== "paid") repo.updateDeal(od.id, { status: "cancelled" });
      }
    }
    return repo.getDeal(deal.id)!;
  }

  /**
   * ?demo=1 only: marks a deal paid with canned, clearly labelled ids. PayPal is never called, so no payment
   * exists; the ids start with "DEMO-" so they can never be mistaken for a real capture.
   */
  demoPay(dealId: string): Deal {
    const deal = this.d.repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "paid") return deal; // idempotent
    if (deal.status === "cancelled" || deal.status === "refunded") throw new PaymentError(`Deal was ${deal.status}`, "conflict");
    const want = this.d.repo.getWant(deal.wantId);
    if (!want || want.status !== "open") throw new PaymentError("This want has already been purchased", "conflict");
    return this.settle(deal, {
      payerId: "DEMO-PAYER",
      payerEmail: null,
      captureId: `DEMO-CAPTURE-${deal.id}`,
      proof: `Payment sent: $${deal.price} (DEMO MODE: no real PayPal payment was made). Proof of payment: DEMO-PAYER, capture DEMO-CAPTURE-${deal.id}. Thanks for the smooth deal!`,
    });
  }

  /** Fully refund a paid deal, tell the seller, and reopen the want so it can be negotiated again. */
  async refundDeal(dealId: string): Promise<Deal> {
    const { repo } = this.d;
    const deal = repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "refunded") return deal; // idempotent
    if (deal.status !== "paid" || !deal.captureId) throw new PaymentError("Only a paid deal can be refunded", "conflict");
    const isDemo = deal.captureId.startsWith("DEMO-");
    const api = this.d.paymentsApi;
    if (!api && !isDemo) {
      throw new PaymentError("PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local.", "not_configured");
    }

    let refund: { refundId: string | undefined };
    if (isDemo) {
      refund = { refundId: "DEMO-REFUND" }; // a demo payment never reached PayPal, so there is nothing to refund there
    } else {
      try {
        refund = await refundCapture(api!, deal.captureId, `refund-${deal.id}`);
      } catch (err) {
        if (err instanceof PayPalError) throw new PaymentError(err.message, "paypal");
        throw err;
      }
    }
    repo.updateDeal(deal.id, { status: "refunded" });

    const thread = repo.getThread(deal.threadId);
    const want = repo.getWant(deal.wantId);
    if (thread && want) {
      repo.addMessage(thread.id, {
        from: "buyer",
        at: (this.d.now ?? Date.now)(),
        price: null,
        text:
          (isDemo
            ? `Refund issued: $${deal.price} (DEMO MODE: no PayPal payment was made, so nothing was refunded through PayPal). `
            : `Refund issued: $${deal.price} returned via PayPal (capture ${deal.captureId}, refund ${refund.refundId ?? "n/a"}). `) +
          `This message is from Hagglebot, an AI buyer agent acting for ${want.buyerName}.`,
      });
      repo.setWantStatus(want.id, "open");
    }
    return repo.getDeal(deal.id)!;
  }
}
