# 3-minute demo video script

The video must be under 3 minutes, show the project working on the device it was built for, be uploaded to
YouTube as **Public**, and contain no third-party trademarks or copyrighted music. Judges may stop at 3:00.

## The one thing to plan around

A live AI negotiation takes about two minutes (the models are rate-limited), so a full live run does not fit.
Two honest ways to handle it; pick one and say which in the voiceover:

- **Replay (recommended):** run one negotiation before you record. When the page loads, a finished negotiation
  replays the haggling in about 6 seconds (the "Replaying the negotiation" line, with a Skip button). Say:
  "this is a recorded run of a real negotiation."
- **Live, then cut:** press Negotiate on camera for about 10 seconds (the "Live: 4 of 4 sellers" pill and the
  "is writing" lines), then cut to the finished state in the edit. Say that you sped it up.

## Before you record (checklist)

1. `.env.local` has your real values (PayPal Client ID, Secret, sandbox buyer email, sandbox business email, and
   the Gemini and Groq keys). Check `http://localhost:3001/api/state`: `llmMode` must be `llm`, and
   `paypalClientId` must be your real id, not a placeholder.
2. Do one full negotiation the day before and read it. Model names get retired; if sellers go quiet or the log
   says a model failed, set `GEMINI_MODEL` / `GROQ_MODEL` in `.env.local`.
3. Reset to a clean slate: stop the dev server, run `pnpm demo:reset`, start `pnpm dev`. The reset only deletes
   the local `data/` folder.
4. Open the PayPal sandbox buyer login in another tab, and allow popups for localhost.
5. Run **Load demo scenario**, then **Negotiate** once and let it finish, so the replay is ready.
6. Browser at 1440x900, zoom 100%, bookmarks bar hidden, notifications off, no real personal data on screen,
   and no tabs with real accounts. Turn on reduced motion in your OS only if you want a calmer replay.
7. No music. Narrate over the screen recording.

## Script

| Time | Show | Say |
|---|---|---|
| 0:00 | The app with the demo want selected. | "Getting a fair price means hours of haggling. Hagglebot is an AI buyer agent that does it for you: it negotiates with several sellers at once, never goes over your budget, and then pays through PayPal. This is the PayPal sandbox, so no real money moves." |
| 0:15 | Click **New want** and show the three styles (Patient, Balanced, Quick). Close the form without saving. | "You tell it what you want, your maximum price, and how hard to haggle. The style only changes pacing: the budget ceiling is the same for every style." |
| 0:30 | Reload the page so the replay plays, or press **Negotiate** and show **Live: 4 of 4 sellers** and the roster lines ("Hagglebot is writing…"). | "Four simulated sellers, each with their own personality and a fact sheet for their listing. Hagglebot talks to all of them in parallel. The budget is never shown to them." |
| 0:50 | Click **Fast Ferdi**. Let the lane finish: the ask comes down, the offer goes up, the gap closes. | "Yellow is their ask, blue is our offer, and the grey bar is the gap. A deal happens when it closes." |
| 1:05 | Scroll Ferdi's chat to the top. Point at the first message and its shield note. | "Hagglebot asks real questions, like colour and shipping, and the seller answers from their listing. Under its first message is a guardrail note: it introduced itself as an AI. The code adds that line, so the model can't skip it." |
| 1:25 | Click **Shady Sam**. Show the fee message and the red guardrail note. | "Sam agrees to $220, then adds a processing fee and asks to pay outside PayPal. Hagglebot refuses and leaves, and the note says exactly why." |
| 1:45 | Click **Firm Fatima** for a few seconds, then the summary cards. | "Fatima never moves, so it walks away politely. Ferdi closes at $205 and Chen at $246, both under budget." |
| 2:00 | Click **Review and pay** to open the Deals tab. Click **Confirm and Pay $205**. | "The price comes from the database, never from the browser." |
| 2:10 | PayPal popup: log in as the sandbox buyer and approve. | "PayPal Orders v2: create the order, approve it in PayPal's checkout, then capture." |
| 2:30 | The card shows **Paid** with the payer-id. Optional, 5 seconds: click **Refund**, confirm. | "Hagglebot sends the seller proof of payment and withdraws from the others. A paid deal can also be fully refunded through PayPal." |
| 2:45 | The README on GitHub, honest-limits section. | "The code decides every price; the AI only phrases it. This is a demo: PayPal sandbox only and simulated sellers. It's MIT-licensed on GitHub." |

## If something goes wrong on the day

- **A seller goes quiet or the AI badge says "template negotiator":** the keys or model names need attention;
  see the checklist. The demo still works in template mode, but the chats read as plain text.
- **PayPal popup does not open:** allow popups for localhost, then click Confirm and Pay again.
- **The replay did not play:** it only plays for a finished negotiation the first time a page opens; reload the
  page, or click **Restart** to run a fresh one.
- **Over time:** cut the Fatima beat first, then the style picker.

Upload to YouTube as **Public**, and paste the link into the Devpost submission.
