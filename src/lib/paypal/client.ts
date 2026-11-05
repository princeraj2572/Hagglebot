import { Client, Environment, OrdersController, PaymentsController } from "@paypal/paypal-server-sdk";
import type { PayPalConfig } from "./config";

/**
 * Builds a client bound to the PayPal SANDBOX.
 * The environment is hard-coded on purpose: Hagglebot never talks to live
 * PayPal, so there is no switch that could move real money.
 */
function sandboxClient(config: PayPalConfig): Client {
  return new Client({
    environment: Environment.Sandbox,
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
  });
}

export function createOrdersController(config: PayPalConfig): OrdersController {
  return new OrdersController(sandboxClient(config));
}

/** Payments v2 (refunds of captured payments). */
export function createPaymentsController(config: PayPalConfig): PaymentsController {
  return new PaymentsController(sandboxClient(config));
}
