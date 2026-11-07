import type { Deal, Repo } from "./repo";
import type { NegotiationRunner } from "./runner";

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export interface PaymentDeps {
  repo: Repo;
  runner: NegotiationRunner;
  now?: () => number;
}

/**
 * Mock payments: nothing real is ever charged. A payment records clearly labelled MOCK ids and runs the same
 * follow-up a real one would: tell the seller, mark the want bought, withdraw from the other sellers.
 */
export class PaymentService {
  constructor(private readonly d: PaymentDeps) {}

  /** A bundle's total is a hard ceiling: nothing is paid that would take the bundle over it. */
  private assertWithinBundle(deal: Deal): void {
    const room = this.d.repo.bundleRoom(deal.wantId);
    if (room !== null && deal.price > room) {
      throw new PaymentError(`This would take the bundle over its budget: only $${Math.max(0, room)} is left.`, "conflict");
    }
  }

  /** Pay a closed deal (mock). The amount always comes from our database. Idempotent. */
  pay(dealId: string): Deal {
    const { repo } = this.d;
    const deal = repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "paid") return deal;
    if (deal.status === "cancelled" || deal.status === "refunded") throw new PaymentError(`Deal was ${deal.status}`, "conflict");
    const want = repo.getWant(deal.wantId);
    if (!want || want.status !== "open") throw new PaymentError("This want has already been purchased", "conflict");
    this.assertWithinBundle(deal);

    repo.updateDeal(deal.id, { status: "paid", payerId: "MOCK-PAYER", payerEmail: null, captureId: `MOCK-PAYMENT-${deal.id}` });
    const thread = repo.getThread(deal.threadId);
    if (thread) {
      repo.addMessage(thread.id, {
        from: "buyer",
        at: (this.d.now ?? Date.now)(),
        price: deal.price,
        text:
          `Payment sent: $${deal.price} (mock payment: no real money moved). Proof of payment: MOCK-PAYER, payment MOCK-PAYMENT-${deal.id}. ` +
          `Thanks for the smooth deal! This message is from Hagglebot, an AI buyer agent acting for ${want.buyerName}.`,
      });
    }
    repo.setWantStatus(want.id, "purchased");
    for (const other of repo.listThreads(want.id)) {
      if (other.id === deal.threadId) continue;
      this.d.runner.withdraw(other.id);
      const od = repo.listDeals(want.id).find((x) => x.threadId === other.id);
      if (od && od.status !== "paid") repo.updateDeal(od.id, { status: "cancelled" });
    }
    return repo.getDeal(deal.id)!;
  }

  /** Refund a paid deal (mock), tell the seller, and reopen the want so it can be negotiated again. Idempotent. */
  refundDeal(dealId: string): Deal {
    const { repo } = this.d;
    const deal = repo.getDeal(dealId);
    if (!deal) throw new PaymentError("Deal not found", "not_found");
    if (deal.status === "refunded") return deal;
    if (deal.status !== "paid") throw new PaymentError("Only a paid deal can be refunded", "conflict");

    repo.updateDeal(deal.id, { status: "refunded" });
    const thread = repo.getThread(deal.threadId);
    const want = repo.getWant(deal.wantId);
    if (thread && want) {
      repo.addMessage(thread.id, {
        from: "buyer",
        at: (this.d.now ?? Date.now)(),
        price: null,
        text: `Refund issued: $${deal.price} (mock refund: nothing real was charged). This message is from Hagglebot, an AI buyer agent acting for ${want.buyerName}.`,
      });
      repo.setWantStatus(want.id, "open");
    }
    return repo.getDeal(deal.id)!;
  }
}
