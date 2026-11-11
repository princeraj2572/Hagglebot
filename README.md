# Hagglebot

**An AI buyer agent that finds sellers, haggles with several of them at once under your budget, walks away from scams, and pays.**

This is the **mock-only** version: sellers, negotiation and payments are all simulated, so it runs with no accounts or API keys and no real money ever moves.

## How it works

1. **Add a want**: what you want, your maximum price, and a style (patient, balanced or quick). Leave *Find sellers and negotiate for me* ticked and Hagglebot does the rest.
2. **Find products**: the Marketplace tab searches real listings (Channel3, optional key) with the condition (new, used, refurbished) shown on every card. **Negotiate this** adds a listing as a seller, **Buy** skips the haggling and pays the listed price.
3. **Negotiate**: Hagglebot chats with every seller in parallel. Each seller is played by a random persona from a pool of 14: friendly, firm, chatty, and a few who try to scam (hidden "processing fees", paying off-platform). Your budget is never shown to them.
4. **Guardrails**: the code decides every price and move; templates only phrase them. The budget is a hard ceiling, the buyer always says it is an AI, and a scam attempt ends the conversation. Each guardrail that fires is shown next to the message that triggered it.
5. **Pay**: a closed deal shows **Confirm and Pay**. The mock payment records `MOCK-` ids, tells the seller, marks the want bought and withdraws from the others. A refund reopens the want.

Also: approve-before-accepting, bundles with a shared budget, a savings summary (AG Grid), and a downloadable transcript per negotiation.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3001
pnpm test         # unit and API tests
pnpm build && pnpm start
```

Optional `.env.local` (see `.env.example`): `CHANNEL3_API_KEY`, `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` and/or `ETSY_API_KEY` for real listings (each source is searched when its key is set; categories come from Channel3), `HAGGLEBOT_STEP_DELAY_MS` for pacing. Data lives in `data/hagglebot.db`; `pnpm reset` wipes it.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · SQLite (better-sqlite3) · AG Grid Community · vitest · Channel3 API (listings). The HTTP API is described in [docs/openapi.yaml](docs/openapi.yaml).

## Limits

Simulation only: not a purchasing agent and not financial advice. There is no authentication, and no retailer is ever contacted; real listings only supply the product, price, retailer and condition.
