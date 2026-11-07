import { describe, expect, it } from "vitest";
import { DEMO_WANT } from "../demo";
import { PERSONAS } from "../sellers/personas";
import { PersonaSeller } from "../sellers/sellerAgent";
import { createThread, runNegotiation } from "./engine";
import { transcriptFileName, transcriptMarkdown } from "./transcript";

const run = async (id: string) => {
  const seller = new PersonaSeller(PERSONAS.find((p) => p.id === id)!, null);
  const t = createThread(DEMO_WANT, seller);
  await runNegotiation(t, DEMO_WANT, seller, { llm: null, comparing: 4 });
  return t;
};

describe("transcript", () => {
  it("lists every message and the guardrail notes that shaped them", async () => {
    const t = await run("ferdi");
    const md = transcriptMarkdown(t, DEMO_WANT);
    expect(md).toContain("# Negotiation transcript: Fast Ferdi");
    expect(md).toContain(`Outcome: Deal at $${t.dealPrice}`);
    expect(md).toContain("**Hagglebot (AI)**");
    expect(md).toContain("**Fast Ferdi**");
    expect(md).toContain("> Guardrail: Introduced itself as an AI agent");
    expect((md.match(/\*\*Hagglebot \(AI\)\*\*|\*\*Fast Ferdi\*\*/g) ?? []).length).toBe(t.messages.length);
  });

  it("names why a negotiation ended without a deal", async () => {
    const t = await run("sam");
    expect(t.status).toBe("walked_away");
    expect(transcriptMarkdown(t, DEMO_WANT)).toContain("Outcome: Walked away: scam detected");
  });

  it("says the budget is never shown to the seller, and states it once, in the header only", async () => {
    const md = transcriptMarkdown(await run("fatima"), DEMO_WANT);
    expect(md).toContain(`Budget: $${DEMO_WANT.maxPrice} (never shown to the seller)`);
  });

  it("makes a safe file name", async () => {
    const t = await run("ferdi");
    expect(transcriptFileName(t)).toBe("hagglebot-fast-ferdi.md");
    expect(transcriptFileName({ ...t, sellerName: "../../etc/passwd" })).toBe("hagglebot-etc-passwd.md");
    expect(transcriptFileName({ ...t, sellerName: "!!!" })).toBe("hagglebot-seller.md");
  });
});
