# PayPal sandbox setup

Hagglebot only ever talks to the PayPal **sandbox** (the environment is hard-coded in
`src/lib/paypal/client.ts`). No real money moves.

1. Sign in at <https://developer.paypal.com/dashboard/> with any PayPal account.
2. **Apps & Credentials** -> *Sandbox* tab -> **Create App** (type: Merchant). Copy the
   Client ID and Secret.
3. **Testing tools -> Sandbox accounts**: you get a default *Business* (seller) and
   *Personal* (buyer) account. Note both emails; use *View/Edit account* to see the
   buyer's password.
4. `cp .env.example .env.local` and fill in the four variables. `.env.local` is gitignored.

## Smoke test (create -> approve -> capture)

```bash
pnpm paypal:smoke        # 1.00 USD
pnpm paypal:smoke 12.34
```

The script creates an order, prints an approval URL, and polls until you log in as the
sandbox **buyer** in a browser and approve it (PayPal requires this human step). It then
captures the order and prints the payer-id and capture id.

Unit tests (`pnpm test`) use a fake controller and need no network or credentials.
