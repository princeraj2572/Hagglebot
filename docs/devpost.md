## Hagglebot

**Problem.** Getting a fair price means hours of research and awkward haggling with strangers. Most people just pay the sticker price, and sellers know it.

**Solution.** Hagglebot is an AI buyer agent. You enter what you want and your maximum price. It opens chats with several sellers in parallel, anchors low, concedes in small steps, and closes only when a price fits your budget. Then it creates a PayPal order; you press "Confirm and Pay", approve in PayPal's checkout, and Hagglebot sends the seller a confirmation containing the PayPal payer-id as proof. A live dashboard shows every thread, the latest offers, and a Pause killswitch.

**Agentic commerce, done honestly.** Hagglebot always introduces itself as an AI buyer agent and never impersonates you. The code, not the prompt, decides every price, so the budget can't be exceeded. The language model only phrases each move, and its output is checked: wrong prices, budget leaks and claims to be human are rejected. It walks away after repeated refusals, at the message limit, or on scam signals such as hidden fees and off-platform payment. In our demo, "Shady Sam" tries exactly that and is refused.

**Tech.** Next.js 15, TypeScript, Tailwind, SQLite, PayPal Orders v2 (official server SDK plus the JS checkout), and Gemini 2.0 Flash with an automatic Groq fallback and a template negotiator if no model is reachable.

**Honest limits.** This is a demo: PayPal sandbox only (no real money), and the four sellers are simulated AI personas, not real listings. The scam detector is heuristic.

**Try it.** MIT licensed; clone, add sandbox credentials, run `pnpm dev`, and press "Load demo scenario".
