import type { OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";
import { describe, expect, it, vi } from "vitest";
import { PaymentError } from "./payments";
import { makeKit, seedDemo } from "./testkit";

function fakeOrders() {
  const createOrder = vi.fn().mockResolvedValue({
    result: { id: "ORD-1", status: "CREATED", links: [{ rel: "approve", href: "https://sandbox/approve" }] },
  });
  const captureOrder = vi.fn().mockResolvedValue({
    result: {
      id: "ORD-1", status: "COMPLETED", payer: { payerId: "PAYER9", emailAddress: "buyer@example.com" },
      purchaseUnits: [{ payments: { captures: [{ id: "CAP-1", amount: { value: "205.00", currencyCode: "USD" } }] } }],
    },
  });
  return { createOrder, captureOrder, controller: { createOrder, captureOrder } as unknown as OrdersController };
}

function fakeRefunds() {
  const refundCapturedPayment = vi.fn().mockResolvedValue({ result: { id: "REF-1", status: "COMPLETED" } });
  return { refundCapturedPayment, refundsApi: { refundCapturedPayment } as unknown as PaymentsController };
}

async function setup() {
  const f = fakeOrders();
  const r = fakeRefunds();
  const kit = makeKit(f.controller, r.refundsApi);
  const want = seedDemo(kit.repo);
  kit.runner.start(want.id);
  await kit.runner.idle();
  const ferdiDeal = kit.repo.listDeals(want.id).find((d) => d.sellerName === "Fast Ferdi")!;
  const chenDeal = kit.repo.listDeals(want.id).find((d) => d.sellerName === "Chatty Chen")!;
  return { ...kit, ...f, ...r, want, ferdiDeal, chenDeal };
}

describe("PaymentService", () => {
  it("creates an order using the price from the database", async () => {
    const s = await setup();
    const { orderId, deal } = await s.payments.createOrderForDeal(s.ferdiDeal.id);
    expect(orderId).toBe("ORD-1");
    expect(deal).toMatchObject({ status: "order_created", paypalOrderId: "ORD-1" });
    const body = s.createOrder.mock.calls[0]![0].body;
    expect(body.purchaseUnits[0].amount).toEqual({ currencyCode: "USD", value: "205.00" });
    expect(body.purchaseUnits[0].payee).toEqual({ emailAddress: "seller@example.com" });
  });

  it("captures, records payer-id, confirms to the seller and withdraws from the others", async () => {
    const s = await setup();
    await s.payments.createOrderForDeal(s.ferdiDeal.id);
    const paid = await s.payments.captureForOrder("ORD-1");
    expect(paid).toMatchObject({ status: "paid", payerId: "PAYER9", captureId: "CAP-1" });

    const thread = s.repo.getThread(s.ferdiDeal.threadId)!;
    const last = thread.messages.at(-1)!;
    expect(last.from).toBe("buyer");
    expect(last.text).toContain("payer-id PAYER9");
    expect(last.text).toContain("AI buyer agent");

    expect(s.repo.getWant(s.want.id)!.status).toBe("purchased");
    const chen = s.repo.getThread(s.chenDeal.threadId)!;
    expect(chen).toMatchObject({ status: "walked_away", reason: "purchased_elsewhere" });
    expect(s.repo.getDeal(s.chenDeal.id)!.status).toBe("cancelled");
    await expect(s.payments.createOrderForDeal(s.chenDeal.id)).rejects.toThrow(/already cancelled/);
  });

  it("capture is idempotent and never captures unknown orders", async () => {
    const s = await setup();
    await s.payments.createOrderForDeal(s.ferdiDeal.id);
    await s.payments.captureForOrder("ORD-1");
    await s.payments.captureForOrder("ORD-1");
    expect(s.captureOrder).toHaveBeenCalledTimes(1);
    await expect(s.payments.captureForOrder("ORD-EVIL")).rejects.toMatchObject({ code: "not_found" });
  });

  it("reports a PayPal failure without marking the deal paid", async () => {
    const s = await setup();
    s.captureOrder.mockResolvedValueOnce({ result: { id: "ORD-1", status: "PAYER_ACTION_REQUIRED" } });
    await s.payments.createOrderForDeal(s.ferdiDeal.id);
    await expect(s.payments.captureForOrder("ORD-1")).rejects.toMatchObject({ code: "paypal" });
    expect(s.repo.getDeal(s.ferdiDeal.id)!.status).toBe("order_created");
    expect(s.repo.getWant(s.want.id)!.status).toBe("open");
  });

  it("refunds a paid deal in full, tells the seller and reopens the want", async () => {
    const s = await setup();
    await s.payments.createOrderForDeal(s.ferdiDeal.id);
    await s.payments.captureForOrder("ORD-1");
    const refunded = await s.payments.refundDeal(s.ferdiDeal.id);
    expect(refunded.status).toBe("refunded");
    expect(s.refundCapturedPayment).toHaveBeenCalledTimes(1);
    expect(s.refundCapturedPayment.mock.calls[0]![0]).toMatchObject({ captureId: "CAP-1", paypalRequestId: `refund-${s.ferdiDeal.id}`, body: {} });
    const last = s.repo.getThread(s.ferdiDeal.threadId)!.messages.at(-1)!;
    expect(last.text).toContain("Refund issued");
    expect(last.text).toContain("REF-1");
    expect(s.repo.getWant(s.want.id)!.status).toBe("open");
    // a refunded deal can be neither paid nor captured again
    await expect(s.payments.createOrderForDeal(s.ferdiDeal.id)).rejects.toThrow(/already refunded/);
    await expect(s.payments.captureForOrder("ORD-1")).rejects.toMatchObject({ code: "conflict" });
  });

  it("refund is idempotent and only works on paid deals", async () => {
    const s = await setup();
    await expect(s.payments.refundDeal(s.ferdiDeal.id)).rejects.toMatchObject({ code: "conflict" });
    await expect(s.payments.refundDeal("nope")).rejects.toMatchObject({ code: "not_found" });
    await s.payments.createOrderForDeal(s.ferdiDeal.id);
    await s.payments.captureForOrder("ORD-1");
    await s.payments.refundDeal(s.ferdiDeal.id);
    await s.payments.refundDeal(s.ferdiDeal.id);
    expect(s.refundCapturedPayment).toHaveBeenCalledTimes(1);
  });

  it("keeps the deal paid when PayPal does not complete the refund", async () => {
    const s = await setup();
    s.refundCapturedPayment.mockResolvedValueOnce({ result: { id: "REF-2", status: "FAILED" } });
    await s.payments.createOrderForDeal(s.ferdiDeal.id);
    await s.payments.captureForOrder("ORD-1");
    await expect(s.payments.refundDeal(s.ferdiDeal.id)).rejects.toMatchObject({ code: "paypal" });
    expect(s.repo.getDeal(s.ferdiDeal.id)!.status).toBe("paid");
    expect(s.repo.getWant(s.want.id)!.status).toBe("purchased");
  });

  it("refund needs PayPal credentials", async () => {
    const f = fakeOrders();
    const kit = makeKit(f.controller, null);
    const want = seedDemo(kit.repo);
    kit.runner.start(want.id);
    await kit.runner.idle();
    const deal = kit.repo.listDeals(want.id).find((d) => d.sellerName === "Fast Ferdi")!;
    await kit.payments.createOrderForDeal(deal.id);
    await kit.payments.captureForOrder("ORD-1");
    await expect(kit.payments.refundDeal(deal.id)).rejects.toMatchObject({ code: "not_configured" });
  });

  it("is disabled cleanly when PayPal is not configured", async () => {
    const kit = makeKit(null);
    const want = seedDemo(kit.repo);
    kit.runner.start(want.id);
    await kit.runner.idle();
    const deal = kit.repo.listDeals(want.id)[0]!;
    const err = await kit.payments.createOrderForDeal(deal.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PaymentError);
    expect(err).toMatchObject({ code: "not_configured" });
  });
});
