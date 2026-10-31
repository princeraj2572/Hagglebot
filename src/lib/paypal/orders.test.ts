import { describe, expect, it, vi } from "vitest";
import { ApiError, OrderStatus, type OrdersController } from "@paypal/paypal-server-sdk";
import { loadPayPalConfig } from "./config";
import {
  PayPalError,
  assertValidAmount,
  captureOrder,
  createOrder,
  waitForApproval,
} from "./orders";

function fake(overrides: Record<string, unknown>): OrdersController {
  return overrides as unknown as OrdersController;
}

describe("loadPayPalConfig", () => {
  it("lists every missing required var", () => {
    expect(() => loadPayPalConfig({})).toThrow(/PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET/);
  });
  it("trims values and treats blank emails as undefined", () => {
    const c = loadPayPalConfig({
      PAYPAL_CLIENT_ID: " id ",
      PAYPAL_CLIENT_SECRET: "sec",
      PAYPAL_BUYER_EMAIL: " ",
    });
    expect(c).toEqual({ clientId: "id", clientSecret: "sec", buyerEmail: undefined, sellerEmail: undefined });
  });
});

describe("assertValidAmount", () => {
  it.each(["1.00", "42.50", "0.99"])("accepts %s", (a) => expect(() => assertValidAmount(a)).not.toThrow());
  it.each(["0.00", "-1.00", "1", "1.5", "abc", "01.00", "1.001"])("rejects %s", (a) =>
    expect(() => assertValidAmount(a)).toThrow(PayPalError),
  );
});

describe("createOrder", () => {
  it("sends a CAPTURE order with payee and returns the approve link", async () => {
    const createOrderFn = vi.fn().mockResolvedValue({
      result: {
        id: "ORDER1",
        status: "PAYER_ACTION_REQUIRED",
        links: [
          { rel: "self", href: "https://api/self" },
          { rel: "payer-action", href: "https://sandbox.paypal.com/checkoutnow?token=ORDER1" },
        ],
      },
    });
    const out = await createOrder(
      fake({ createOrder: createOrderFn }),
      { amount: "42.50", description: "Black headphones", sellerEmail: "seller@example.com", referenceId: "deal-1" },
      "req-1",
    );
    expect(out).toEqual({
      orderId: "ORDER1",
      status: "PAYER_ACTION_REQUIRED",
      approveUrl: "https://sandbox.paypal.com/checkoutnow?token=ORDER1",
    });
    const arg = createOrderFn.mock.calls[0]![0];
    expect(arg.paypalRequestId).toBe("req-1");
    expect(arg.body.intent).toBe("CAPTURE");
    expect(arg.body.purchaseUnits[0]).toMatchObject({
      amount: { currencyCode: "USD", value: "42.50" },
      payee: { emailAddress: "seller@example.com" },
      referenceId: "deal-1",
    });
  });

  it("rejects a bad amount before calling PayPal", async () => {
    const createOrderFn = vi.fn();
    await expect(
      createOrder(fake({ createOrder: createOrderFn }), { amount: "9", description: "x", referenceId: "d" }),
    ).rejects.toThrow(/Invalid amount/);
    expect(createOrderFn).not.toHaveBeenCalled();
  });

  it("wraps SDK ApiErrors with status code", async () => {
    const err = new ApiError(
      {
        request: {} as never,
        response: { statusCode: 422, headers: {}, body: '{"name":"UNPROCESSABLE_ENTITY"}' },
      },
      "boom",
    );
    await expect(
      createOrder(fake({ createOrder: vi.fn().mockRejectedValue(err) }), {
        amount: "1.00",
        description: "x",
        referenceId: "d",
      }),
    ).rejects.toMatchObject({ name: "PayPalError", statusCode: 422 });
  });
});

describe("captureOrder", () => {
  it("returns payer id and capture details", async () => {
    const captureFn = vi.fn().mockResolvedValue({
      result: {
        id: "ORDER1",
        status: OrderStatus.Completed,
        payer: { payerId: "PAYER123", emailAddress: "buyer@example.com" },
        purchaseUnits: [{ payments: { captures: [{ id: "CAP1", amount: { value: "42.50", currencyCode: "USD" } }] } }],
      },
    });
    expect(await captureOrder(fake({ captureOrder: captureFn }), "ORDER1", "req-2")).toEqual({
      orderId: "ORDER1",
      status: "COMPLETED",
      payerId: "PAYER123",
      payerEmail: "buyer@example.com",
      captureId: "CAP1",
      amount: "42.50",
      currency: "USD",
    });
  });

  it("fails when the order is not COMPLETED", async () => {
    const captureFn = vi.fn().mockResolvedValue({ result: { id: "O", status: "PAYER_ACTION_REQUIRED" } });
    await expect(captureOrder(fake({ captureOrder: captureFn }), "O")).rejects.toThrow(/did not complete/);
  });
});

describe("waitForApproval", () => {
  const sleep = () => Promise.resolve();

  it("returns once the order is APPROVED", async () => {
    const getOrder = vi
      .fn()
      .mockResolvedValueOnce({ result: { status: "CREATED" } })
      .mockResolvedValueOnce({ result: { status: "APPROVED" } });
    await expect(waitForApproval(fake({ getOrder }), "O", { sleep })).resolves.toBeUndefined();
    expect(getOrder).toHaveBeenCalledTimes(2);
  });

  it("throws if voided", async () => {
    const getOrder = vi.fn().mockResolvedValue({ result: { status: "VOIDED" } });
    await expect(waitForApproval(fake({ getOrder }), "O", { sleep })).rejects.toThrow(/voided/);
  });

  it("times out", async () => {
    const getOrder = vi.fn().mockResolvedValue({ result: { status: "CREATED" } });
    await expect(
      waitForApproval(fake({ getOrder }), "O", { sleep, timeoutMs: 3000, intervalMs: 1000 }),
    ).rejects.toThrow(/Timed out/);
    expect(getOrder).toHaveBeenCalledTimes(3);
  });
});
