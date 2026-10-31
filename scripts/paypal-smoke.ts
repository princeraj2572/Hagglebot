/**
 * Sandbox smoke test: create -> (you approve in a browser) -> capture.
 *
 *   pnpm paypal:smoke            # amount defaults to 1.00 USD
 *   pnpm paypal:smoke 12.34
 *
 * A buyer must approve an order in PayPal's UI; that cannot be skipped, so the
 * script prints the approval URL and polls until the order is APPROVED.
 */
import { config as loadEnv } from "dotenv";
import { loadPayPalConfig } from "../src/lib/paypal/config";
import { createOrdersController } from "../src/lib/paypal/client";
import { captureOrder, createOrder, waitForApproval } from "../src/lib/paypal/orders";

loadEnv({ path: ".env.local" });

async function main(): Promise<void> {
  const cfg = loadPayPalConfig();
  const orders = createOrdersController(cfg);
  const amount = process.argv[2] ?? "1.00";

  console.log(`[1/3] Creating sandbox order for ${amount} USD ...`);
  const created = await createOrder(orders, {
    amount,
    description: "Hagglebot smoke test",
    sellerEmail: cfg.sellerEmail,
    referenceId: `smoke-${Date.now()}`,
  });
  console.log(`      order ${created.orderId} (${created.status})`);
  if (!created.approveUrl) throw new Error("No approval link in the create-order response");

  console.log("[2/3] Open this URL and log in as the SANDBOX BUYER to approve:");
  console.log(`      ${created.approveUrl}`);
  if (cfg.buyerEmail) console.log(`      (buyer: ${cfg.buyerEmail})`);
  await waitForApproval(orders, created.orderId, {
    onPoll: (s) => process.stdout.write(`\r      status: ${s}        `),
  });
  console.log("\n      approved.");

  console.log("[3/3] Capturing ...");
  const cap = await captureOrder(orders, created.orderId);
  console.log(JSON.stringify(cap, null, 2));
  console.log(`\nOK: captured ${cap.amount} ${cap.currency}, payer-id ${cap.payerId}`);
}

main().catch((err: unknown) => {
  console.error(`\nFAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
