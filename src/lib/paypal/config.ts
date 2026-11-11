
export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  /** Sandbox buyer account email (the persona that approves payments). */
  buyerEmail: string | undefined;
  /** Sandbox seller (merchant) account email; the payee of every order. */
  sellerEmail: string | undefined;
}

const REQUIRED = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"] as const;

/**
 * Reads PayPal settings from the environment. Throws a readable error listing
 * every missing variable so setup problems are obvious.
 */
export function loadPayPalConfig(env: Record<string, string | undefined> = process.env): PayPalConfig {
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing PayPal env vars: ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local and fill in your SANDBOX credentials.`,
    );
  }
  return {
    clientId: env.PAYPAL_CLIENT_ID!.trim(),
    clientSecret: env.PAYPAL_CLIENT_SECRET!.trim(),
    buyerEmail: env.PAYPAL_BUYER_EMAIL?.trim() || undefined,
    sellerEmail: env.PAYPAL_SELLER_EMAIL?.trim() || undefined,
  };
}

