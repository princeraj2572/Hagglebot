# Hagglebot

**An AI buyer agent that finds sellers, haggles with several of them at once under your budget, walks away from scams, and pays.**

Payments go through the **PayPal sandbox** (Orders v2 create and capture, Payments v2 refund), and a language model (Gemini, with Groq as fallback) phrases each message. Sellers are simulated, and no real money ever moves. With no keys set it still runs: payments fall back to a labelled mock and messages to templates.

## How it works

1. **Add a want**: what you want, your maximum price, and a style (patient, balanced or quick). Leave *Find sellers and negotiate for me* ticked and Hagglebot does the rest.
2. **Find products**: the Marketplace tab searches real listings (Channel3, optional key) with the condition (new, used, refurbished) shown on every card. **Negotiate this** adds a listing as a seller, **Buy** skips the haggling and pays the listed price.
3. **Negotiate**: Hagglebot chats with every seller in parallel. Each seller is played by a random persona from a pool of 14: friendly, firm, chatty, and a few who try to scam (hidden "processing fees", paying off-platform). Your budget is never shown to them.
4. **Guardrails**: the code decides every price and move; the language model only phrases them, and its output is checked (wrong prices, budget leaks and claims to be human are rejected, and a template is used instead). The budget is a hard ceiling, the buyer always says it is an AI, and a scam attempt ends the conversation. Each guardrail that fires is shown next to the message that triggered it.
5. **Pay**: a closed deal shows the PayPal checkout. Hagglebot creates a PayPal order for the agreed price (the amount comes from the database, never the browser), you approve it in PayPal, and Hagglebot captures it, sends the seller the PayPal payer id as proof, marks the want bought and withdraws from the others. A refund goes back through PayPal and reopens the want.

Also: approve-before-accepting, bundles with a shared budget, a savings summary (AG Grid), and a downloadable transcript per negotiation.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3001
pnpm test         # unit and API tests
pnpm build && pnpm start
```

Copy `.env.example` to `.env.local` and fill in:

- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`: a **sandbox** app from [developer.paypal.com](https://developer.paypal.com/dashboard/applications/sandbox). Hagglebot is hard-wired to the sandbox. `pnpm paypal:smoke` checks the credentials with a 1.00 USD sandbox order.
- `GEMINI_API_KEY` and/or `GROQ_API_KEY`: free keys for the model that phrases the messages.

Without the PayPal keys, deals are paid with a mock payment whose ids start with `MOCK-`; without a model key, templates write the messages.

Also optional: `CHANNEL3_API_KEY`, `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` and/or `ETSY_API_KEY` for real listings (each source is searched when its key is set; categories come from Channel3), `HAGGLEBOT_STEP_DELAY_MS` for pacing. Data lives in `data/hagglebot.db`; `pnpm reset` wipes it.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · SQLite (better-sqlite3) · PayPal Orders v2 and Payments v2 (official server SDK and the JS checkout, sandbox) · Gemini with Groq fallback · AG Grid Community · vitest · Channel3, eBay and Etsy APIs (listings). The HTTP API is described in [docs/openapi.yaml](docs/openapi.yaml).

## Limits

PayPal sandbox only, and the sellers are simulated: not a purchasing agent and not financial advice. There is no authentication, and no retailer is ever contacted; real listings only supply the product, price, retailer and condition.
