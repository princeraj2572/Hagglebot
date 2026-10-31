import { Client, Environment, OrdersController } from "@paypal/paypal-server-sdk";
import type { PayPalConfig } from "./config";

/**
 * Builds an Orders controller bound to the PayPal SANDBOX.
 * The environment is hard-coded on purpose: Hagglebot never talks to live
 * PayPal, so there is no switch that could move real money.
 */
export function createOrdersController(config: PayPalConfig): OrdersController {
  const client = new Client({
    environment: Environment.Sandbox,
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
  });
  return new OrdersController(client);
}
