import { randomUUID } from "node:crypto";
import {
  ApiError,
  CheckoutPaymentIntent,
  OrderStatus,
  type OrdersController,
} from "@paypal/paypal-server-sdk";

export interface CreateOrderParams {
  /** Price as a decimal string with at most 2 decimals, e.g. "42.50". */
  amount: string;
  currency?: string;
  description: string;
  /** Sandbox seller email; becomes the payee. */
  sellerEmail?: string | undefined;
  /** Our own id for the deal (stored as PayPal reference_id / custom_id). */
  referenceId: string;
}

export interface CreatedOrder {
  orderId: string;
  status: string;
  /** URL the buyer opens to approve (rel "approve" or "payer-action"). */
  approveUrl: string | undefined;
}

export interface CapturedOrder {
  orderId: string;
  status: string;
  payerId: string | undefined;
  payerEmail: string | undefined;
  captureId: string | undefined;
  amount: string | undefined;
  currency: string | undefined;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

const AMOUNT_RE = /^(0|[1-9]\d*)\.\d{2}$/;

export function assertValidAmount(amount: string): void {
  if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) {
    throw new PayPalError(
      `Invalid amount "${amount}": expected a positive decimal with 2 places, e.g. "42.50"`,
    );
  }
}

function wrap(action: string, err: unknown): never {
  if (err instanceof ApiError) {
    const body = typeof err.body === "string" ? err.body : JSON.stringify(err.result ?? err.body);
    throw new PayPalError(`PayPal ${action} failed (HTTP ${err.statusCode}): ${body}`, err.statusCode, err.result);
  }
  throw err;
}

/** Orders v2: create an order with intent CAPTURE (needs buyer approval next). */
export async function createOrder(
  orders: OrdersController,
  p: CreateOrderParams,
  requestId: string = randomUUID(),
): Promise<CreatedOrder> {
  assertValidAmount(p.amount);
  try {
    const { result } = await orders.createOrder({
      paypalRequestId: requestId,
      prefer: "return=representation",
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            referenceId: p.referenceId,
            customId: p.referenceId,
            description: p.description.slice(0, 127),
            amount: { currencyCode: p.currency ?? "USD", value: p.amount },
            ...(p.sellerEmail ? { payee: { emailAddress: p.sellerEmail } } : {}),
          },
        ],
      },
    });
    if (!result.id) throw new PayPalError("PayPal create order returned no order id");
    const link = result.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
    return { orderId: result.id, status: String(result.status ?? "UNKNOWN"), approveUrl: link?.href };
  } catch (err) {
    return wrap("create order", err);
  }
}

export async function getOrderStatus(orders: OrdersController, orderId: string): Promise<string> {
  try {
    const { result } = await orders.getOrder({ id: orderId });
    return String(result.status ?? "UNKNOWN");
  } catch (err) {
    return wrap("get order", err);
  }
}

/** Orders v2: capture an order the buyer has already approved. */
export async function captureOrder(
  orders: OrdersController,
  orderId: string,
  requestId: string = randomUUID(),
): Promise<CapturedOrder> {
  try {
    const { result } = await orders.captureOrder({
      id: orderId,
      paypalRequestId: requestId,
      prefer: "return=representation",
    });
    const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
    if (result.status !== OrderStatus.Completed) {
      throw new PayPalError(`Capture did not complete (order status ${String(result.status)})`);
    }
    return {
      orderId: result.id ?? orderId,
      status: String(result.status),
      payerId: result.payer?.payerId,
      payerEmail: result.payer?.emailAddress,
      captureId: capture?.id,
      amount: capture?.amount?.value,
      currency: capture?.amount?.currencyCode,
    };
  } catch (err) {
    return wrap("capture order", err);
  }
}

export interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onPoll?: (status: string) => void;
}

/** Polls until the buyer approves (status APPROVED). Fails on VOIDED or timeout. */
export async function waitForApproval(
  orders: OrdersController,
  orderId: string,
  opts: WaitOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const attempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));
  for (let i = 0; i < attempts; i++) {
    const status = await getOrderStatus(orders, orderId);
    opts.onPoll?.(status);
    if (status === OrderStatus.Approved) return;
    if (status === OrderStatus.Voided) throw new PayPalError("Order was voided before approval");
    if (status === OrderStatus.Completed) return;
    await sleep(intervalMs);
  }
  throw new PayPalError(`Timed out after ${timeoutMs / 1000}s waiting for buyer approval`);
}
