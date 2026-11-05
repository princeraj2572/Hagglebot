# 3-minute demo video script

Record at 1080p. Run with `HAGGLEBOT_STEP_DELAY_MS=1500` so threads visibly progress. Start with an empty database
(`rm -rf data`) and log in to the PayPal sandbox buyer account in another tab beforehand.

| Time | Show | Say |
|---|---|---|
| 0:00 | Empty dashboard, sandbox badge | "Hagglebot is an AI buyer agent. You give it a wishlist and a budget, and it haggles for you, then pays through PayPal. This is sandbox only." |
| 0:15 | Add the want (or **Load demo scenario**): Wireless noise-cancelling headphones, max $250, "prefer black, must ship this week" | "I want these headphones for at most $250. The budget is never shown to sellers." |
| 0:35 | Press **Negotiate**: four threads go live | "Four simulated sellers, each with a different personality and cost basis. Hagglebot talks to all of them in parallel." |
| 0:55 | Open **Shady Sam's** chat | "Note the first message: it says it's an AI agent. Now Sam agrees to $220, then adds a processing fee and asks to pay outside PayPal." Show the refusal and the red "scam detected" status. |
| 1:25 | Click **Pause** on one thread, then **Resume** | "Every negotiation has a killswitch." |
| 1:40 | Fatima walks away; Ferdi and Chen reach deals | "Firm Fatima never moved, so Hagglebot walked away politely. Ferdi closes at $205, Chen at $246, both under budget." |
| 2:00 | Deals panel, **Confirm and Pay $205** | "The price comes from the database, not the browser." |
| 2:10 | PayPal sandbox popup: log in as buyer, approve | "Orders v2: create, approve in PayPal's checkout, then capture." |
| 2:35 | Deal shows **Paid** with payer-id; open Ferdi's chat: confirmation message; Chen's thread shows withdrawn | "Hagglebot sends the seller a confirmation with the PayPal payer-id as proof, and withdraws from the other sellers." |
| 2:50 | README / honest limits | "Demo only: PayPal sandbox, simulated sellers. Code is MIT-licensed on GitHub." |

Upload to YouTube as **Public**, and paste the link into the Devpost submission.
