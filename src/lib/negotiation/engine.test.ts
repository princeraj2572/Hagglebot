import { describe, expect, it, vi } from "vitest";
import { TEST_WANT } from "../testWant";
import { LLMUnavailableError, type LLM } from "../llm/types";
import { PERSONAS } from "../sellers/personas";
import { PersonaSeller } from "../sellers/sellerAgent";
import { createThread, resume, runNegotiation, step } from "./engine";
import { MAX_MESSAGES } from "./types";

const persona = (id: string) => PERSONAS.find((p) => p.id === id)!;
const run = async (id: string, llm: LLM | null = null) => {
  const seller = new PersonaSeller(persona(id), llm);
  const thread = createThread(TEST_WANT, seller);
  await runNegotiation(thread, TEST_WANT, seller, { llm, comparing: 4 });
  return thread;
};

describe("demo scenario (template mode, no LLM)", () => {
  it("Fast Ferdi: closes early below budget", async () => {
    const t = await run("ferdi");
    expect(t.status).toBe("deal");
    expect(t.dealPrice).toBe(205);
    expect(t.messages.length).toBeLessThanOrEqual(8);
  });

  it("Firm Fatima: refuses to move, so Hagglebot walks away after >3 refusals", async () => {
    const t = await run("fatima");
    expect(t.status).toBe("walked_away");
    expect(t.reason).toBe("too_many_refusals");
    expect(t.dealPrice).toBeNull();
  });

  it("Chatty Chen: slow but kind, deal within budget near the end", async () => {
    const t = await run("chen");
    expect(t.status).toBe("deal");
    expect(t.dealPrice).toBeLessThanOrEqual(TEST_WANT.maxPrice);
    expect(t.messages.length).toBeGreaterThan(8);
  });

  it("Shady Sam: hidden fee and off-platform payment are detected and refused", async () => {
    const t = await run("sam");
    expect(t.status).toBe("walked_away");
    expect(t.reason).toBe("scam_detected");
    expect(t.detail).toMatch(/hidden fee/);
    expect(t.dealPrice).toBeNull();
  });
});

describe("safety invariants", () => {
  it.each(PERSONAS.map((p) => p.id))("%s: <=15 messages, never above budget, AI disclosure first", async (id) => {
    const t = await run(id);
    expect(t.messages.length).toBeLessThanOrEqual(MAX_MESSAGES);
    if (t.dealPrice !== null) expect(t.dealPrice).toBeLessThanOrEqual(TEST_WANT.maxPrice);
    for (const m of t.messages.filter((m) => m.from === "buyer" && m.price !== null)) {
      expect(m.price).toBeLessThanOrEqual(TEST_WANT.maxPrice);
    }
    expect(t.messages[0]?.text.startsWith("Hi, I'm an AI buyer agent for Alex. May I ask about your listing?")).toBe(true);
    // the budget ceiling is never announced
    expect(t.messages.filter((m) => m.from === "buyer").some((m) => /budget|maximum|max\b/i.test(m.text))).toBe(false);
  });
});

describe("LLM output gate", () => {
  const llmReturning = (text: string): LLM => ({ name: "fake", generate: vi.fn().mockResolvedValue(text) });
  const firstBuyerMessage = async (llm: LLM) => {
    const seller = new PersonaSeller(persona("ferdi"), null);
    const t = createThread(TEST_WANT, seller);
    await step(t, TEST_WANT, seller, { llm });
    return t.messages[0]!.text;
  };

  it("uses a clean model message but still prepends the AI disclosure", async () => {
    const text = await firstBuyerMessage(llmReturning("Love these headphones! Would you take $175?"));
    expect(text).toBe("Hi, I'm an AI buyer agent for Alex. May I ask about your listing? Love these headphones! Would you take $175?");
  });

  it.each([
    ["wrong price", "Would you take $300?"],
    ["leaks budget", "My budget is $250 but would you take $175?"],
    ["claims to be human", "I'm a real person and I offer $175."],
    ["no price at all", "These look great, tell me more."],
  ])("rejects a bad model message (%s) and falls back to the template", async (_n, bad) => {
    const text = await firstBuyerMessage(llmReturning(bad));
    expect(text).not.toContain(bad);
    expect(text).toContain("Would you consider $175?");
  });

  it("degrades to templates when the LLM is unavailable", async () => {
    const down: LLM = { name: "down", generate: vi.fn().mockRejectedValue(new LLMUnavailableError("down")) };
    const t = await run("ferdi", down);
    expect(t.status).toBe("deal");
  });
});

describe("pause killswitch", () => {
  it("stops before the next step and resumes where it left off", async () => {
    const seller = new PersonaSeller(persona("chen"), null);
    const t = createThread(TEST_WANT, seller);
    let paused = false;
    const deps = { llm: null };
    await step(t, TEST_WANT, seller, deps);
    paused = true;
    const n = t.messages.length;
    await runNegotiation(t, TEST_WANT, seller, deps, { isPaused: () => paused });
    expect(t.status).toBe("paused");
    expect(t.messages.length).toBe(n);
    paused = false;
    resume(t);
    await runNegotiation(t, TEST_WANT, seller, deps, { isPaused: () => paused });
    expect(t.status).toBe("deal");
  });
});
