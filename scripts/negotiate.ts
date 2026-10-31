/**
 * Runs the demo scenario: Hagglebot negotiates with all 4 simulated sellers in parallel.
 * Uses Gemini/Groq if GEMINI_API_KEY / GROQ_API_KEY are set, else the template negotiator.
 *
 *   pnpm negotiate
 */
import { config as loadEnv } from "dotenv";
import { DEMO_WANT } from "../src/lib/demo";
import { createLLMFromEnv } from "../src/lib/llm";
import { createThread, runNegotiation } from "../src/lib/negotiation/engine";
import { fmt } from "../src/lib/negotiation/money";
import { createDemoSellers } from "../src/lib/sellers";

loadEnv({ path: ".env.local" });

async function main(): Promise<void> {
  const haveKey = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
  const llm = haveKey ? createLLMFromEnv() : null;
  console.log(`Mode: ${haveKey ? "LLM (Gemini -> Groq -> templates)" : "template negotiator (no API keys set)"}`);
  console.log(`Want: ${DEMO_WANT.item}, budget ${fmt(DEMO_WANT.maxPrice)} (never shown to sellers)\n`);

  const sellers = createDemoSellers(llm);
  const threads = await Promise.all(
    sellers.map((seller) => {
      const thread = createThread(DEMO_WANT, seller);
      return runNegotiation(thread, DEMO_WANT, seller, { llm, comparing: sellers.length });
    }),
  );

  for (const t of threads) {
    console.log(`=== ${t.sellerName} ===`);
    for (const m of t.messages) console.log(`${m.from === "buyer" ? "  Hagglebot" : `  ${t.sellerName}`}: ${m.text}`);
    const outcome =
      t.status === "deal" ? `DEAL at ${fmt(t.dealPrice ?? 0)}` : `WALKED AWAY (${t.reason}${t.detail ? `: ${t.detail}` : ""})`;
    console.log(`  -> ${outcome}, ${t.messages.length} messages\n`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
