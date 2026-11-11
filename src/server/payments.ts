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
  /** PayPal Orders v2 (sandbox). null or missing when no sandbox credentials are set: payments are then mocked. */
  orders?: OrdersController | null;
  /** PayPal Payments v2, used for refunds. null or missing when no sandbox credentials are set. */
  paymentsApi?: PaymentsController | null;
  /** Sandbox business account that receives the money; the app's own account when left out. */
  sellerEmail?: string | undefined;
  now?: () => number;
}

const NOT_CONFIGURED = "PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local.";
const MOCK_PREFIX = "MOCK-";

interface Settlement {
  payerId: string | null;
  payerEmail: string | null;
  captureId: string | null;
  proof: string;
}

/**
 * Pays closed deals.
 *
 * With PayPal sandbox credentials: Orders v2 create -> the buyer approves in PayPal's checkout -> capture, and
 * refunds go through Payments v2. Without them: a mock payment that records clearly labelled MOCK ids, so the
 * app still runs with no accounts. Either way the amount comes from our database and no real money moves.
 */
export class PaymentService {
  constructor(private readonly d: PaymentDeps) {}

  /** True when PayPal sandbox credentials are set. */
  get paypalEnabled(): boolean {
    return Boolean(this.d.orders);
  }

  private requireOrders(): OrdersController {
    if (!this.d.orders) throw new PaymentError(NOT_CONFIGURED, "not_configured");
    return this.d.orders;
  }

  /** A bundle's total is a hard ceiling: nothing is paid that would take the bundle over it. */
  private assertWithinBundle(deal: Deal): void {
    const room = this.d.repo.bundleRoom(deal.wantId);
    if (room !== null && deal.price > room) {
      throw new PaymentError(`This would take the bundle over its budget: only $${Math.max(0, room)} is left.`, "conflict");
    }
  }

  /** Create a PayPal order for a closed deal. The amount always comes from our database, never from the browser. */
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
    this.assertWithinBundle(deal);
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

  /** Capture an order the buyer approved, record the payer id, confirm to the seller, withdraw from the rest. Idempotent. */
  async captureForOrder(orderId: string): Promise<Deal> {
    const orders = this.requireOrders();
    const { repo } = this.d;
    const deal = repo.getDealByOrder(orderId);
    if (!deal) throw new PaymentError("Unknown order", "not_found");
    if (deal.status === "paid") return deal;
    if (deal.status === "cancelled" || deal.status === "refunded") throw new PaymentError(`Deal was ${deal.status}`, "conflict");
    const want = repo.getWant(deal.wantId);
    if (!want || want.status !== "open") throw new PaymentError("This want has already been purchased", "conflict");
    this.assertWithinBundle(deal);

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
      proof:
        `Payment sent: $${deal.price} via PayPal (sandbox). Proof of payment: PayPal payer-id ${cap.payerId ?? "n/a"}, ` +
        `capture ${cap.captureId ?? "n/a"} (order ${orderId}). Thanks for the smooth deal!`,
    });
  }

  /**
   * Mock payment, for running with no PayPal credentials. Records clearly labelled MOCK ids and runs the same
   * follow-up as a real one. Refused when PayPal is configured, so a mock can never stand in for a real payment.
   * Idempotent.
   */
  pay(dealId: string): Deal {
    if (this.paypalEnabled) throw new PaymentError("PayPal is configured: pay through the PayPal checkout.", "conflict");
    const { repo } = this.d;
    const deal = repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "paid") return deal;
    if (deal.status === "cancelled" || deal.status === "refunded") throw new PaymentError(`Deal was ${deal.status}`, "conflict");
    const want = repo.getWant(deal.wantId);
    if (!want || want.status !== "open") throw new PaymentError("This want has already been purchased", "conflict");
    this.assertWithinBundle(deal);
    return this.settle(deal, {
      payerId: `${MOCK_PREFIX}PAYER`,
      payerEmail: null,
      captureId: `${MOCK_PREFIX}PAYMENT-${deal.id}`,
      proof:
        `Payment sent: $${deal.price} (mock payment: no real money moved). Proof of payment: ${MOCK_PREFIX}PAYER, ` +
        `payment ${MOCK_PREFIX}PAYMENT-${deal.id}. Thanks for the smooth deal!`,
    });
  }

  /** Records a payment, confirms to the seller, marks the want bought and withdraws from the other sellers. */
  private settle(deal: Deal, paid: Settlement): Deal {
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
   * Fully refund a paid deal, tell the seller, and reopen the want so it can be negotiated again. A PayPal
   * capture is refunded through the Payments API; a mock payment never reached PayPal and is refunded locally.
   * Idempotent.
   */
  async refundDeal(dealId: string): Promise<Deal> {
    const { repo } = this.d;
    const deal = repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "refunded") return deal;
    if (deal.status !== "paid") throw new PaymentError("Only a paid deal can be refunded", "conflict");

    const isMock = !deal.captureId || deal.captureId.startsWith(MOCK_PREFIX);
    let note: string;
    if (isMock) {
      note = `Refund issued: $${deal.price} (mock refund: nothing real was charged).`;
    } else {
      const api = this.d.paymentsApi;
      if (!api) throw new PaymentError(NOT_CONFIGURED, "not_configured");
      try {
        const refund = await refundCapture(api, deal.captureId!, `refund-${deal.id}`);
        note = `Refund issued: $${deal.price} returned via PayPal (sandbox; capture ${deal.captureId}, refund ${refund.refundId ?? "n/a"}).`;
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
        text: `${note} This message is from Hagglebot, an AI buyer agent acting for ${want.buyerName}.`,
      });
      repo.setWantStatus(want.id, "open");
    }
    return repo.getDeal(deal.id)!;
  }
}
