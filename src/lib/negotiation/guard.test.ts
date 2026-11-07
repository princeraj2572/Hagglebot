import { describe, expect, it } from "vitest";
import { TEST_WANT } from "../testWant";
import { LLMUnavailableError, type LLM } from "../llm/types";
import { PERSONAS } from "../sellers/personas";
import { PersonaSeller } from "../sellers/sellerAgent";
import { createThread, runNegotiation } from "./engine";

const run = async (id: string, llm: LLM | null = null) => {
  const seller = new PersonaSeller(PERSONAS.find((p) => p.id === id)!, null); // seller stays in template mode
  const thread = createThread(TEST_WANT, seller);
  await runNegotiation(thread, TEST_WANT, seller, { llm, comparing: 4 });
  return thread;
};
const buyerGuards = (t: { messages: { from: string; guard?: string }[] }) => t.messages.filter((m) => m.from === "buyer").map((m) => m.guard ?? "");

describe("guardrail notes", () => {
  it("the opening says the AI disclosure is added by code", async () => {
    const t = await run("ferdi");
    expect(buyerGuards(t)[0]).toContain("Introduced itself as an AI agent");
    expect(t.messages[0]!.text).toContain("AI buyer agent");
  });

  it("closing a deal records that the price is within budget", async () => {
    const t = await run("ferdi");
    expect(t.status).toBe("deal");
    expect(buyerGuards(t).at(-1)).toContain(`Accepted $${t.dealPrice} by rule`);
    expect(buyerGuards(t).at(-1)).toContain(`$${TEST_WANT.maxPrice} budget`);
  });

  it("walking away after repeated refusals names the rule", async () => {
    const t = await run("fatima");
    expect(t.reason).toBe("too_many_refusals");
    expect(buyerGuards(t).at(-1)).toContain("more than 3 refusals");
  });

  it("a scam records the signals that triggered the walk-away", async () => {
    const t = await run("sam");
    expect(t.reason).toBe("scam_detected");
    expect(buyerGuards(t).at(-1)).toMatch(/Scam signals in the seller's message/);
  });

  it("a rejected model draft is recorded and replaced with safe wording", async () => {
    const liar: LLM = { name: "liar", generate: async () => "Similar models are listed around $175, would you accept that?" };
    const t = await run("ferdi", liar);
    const opening = t.messages[0]!;
    expect(opening.guard).toContain("Draft rejected because it made a market claim");
    expect(opening.text).not.toContain("Similar models");
  });

  it("an unavailable model is recorded and the template is used", async () => {
    const down: LLM = { name: "down", generate: async () => { throw new LLMUnavailableError("offline"); } };
    const t = await run("ferdi", down);
    expect(buyerGuards(t)[0]).toContain("No AI model was available");
    expect(t.status).toBe("deal");
  });

  it("template mode alone adds no draft-rejection noise", async () => {
    const t = await run("chen");
    expect(buyerGuards(t).some((g) => g.includes("Draft rejected"))).toBe(false);
  });
});
