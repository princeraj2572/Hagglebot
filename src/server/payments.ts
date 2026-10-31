import type { OrdersController } from "@paypal/paypal-server-sdk";
import { captureOrder, createOrder, PayPalError } from "../lib/paypal/orders";
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
    if (deal.status === "paid" || deal.status === "cancelled") {
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
    if (deal.status === "cancelled") throw new PaymentError("Deal was cancelled", "conflict");

    let cap;
    try {
      cap = await captureOrder(orders, orderId);
    } catch (err) {
      if (err instanceof PayPalError) throw new PaymentError(err.message, "paypal");
      throw err;
    }
    repo.updateDeal(deal.id, {
      status: "paid",
      payerId: cap.payerId ?? null,
      payerEmail: cap.payerEmail ?? null,
      captureId: cap.captureId ?? null,
    });

    const thread = repo.getThread(deal.threadId);
    const want = repo.getWant(deal.wantId);
    if (thread && want) {
      repo.addMessage(thread.id, {
        from: "buyer",
        at: (this.d.now ?? Date.now)(),
        price: deal.price,
        text:
          `Payment sent: $${deal.price} via PayPal. Proof of payment: PayPal payer-id ${cap.payerId ?? "n/a"}, ` +
          `capture ${cap.captureId ?? "n/a"} (order ${orderId}). Thanks for the smooth deal! ` +
          `This message is from Hagglebot, an AI buyer agent acting for ${want.buyerName}.`,
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
}
