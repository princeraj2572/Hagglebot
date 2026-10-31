import { describe, expect, it, vi } from "vitest";
import { LLMTransientError, LLMUnavailableError, type LLM } from "./types";
import { ResilientLLM } from "./resilient";

const req = { system: "s", turns: [{ role: "user" as const, content: "hi" }] };
const ok = (name: string, text: string): LLM => ({ name, generate: vi.fn().mockResolvedValue(text) });
const flaky = (name: string, retryAfterMs?: number): LLM => ({
  name,
  generate: vi.fn().mockRejectedValue(new LLMTransientError("429", name, retryAfterMs)),
});

describe("ResilientLLM", () => {
  it("uses the first provider when healthy", async () => {
    const a = ok("a", "A");
    const b = ok("b", "B");
    const llm = new ResilientLLM([a, b], { sleep: async () => {} });
    expect(await llm.generate(req)).toBe("A");
    expect(b.generate).not.toHaveBeenCalled();
  });

  it("falls back on a transient error and then skips the cooled-down provider", async () => {
    let t = 0;
    const a = flaky("a");
    const b = ok("b", "B");
    const llm = new ResilientLLM([a, b], { now: () => t, sleep: async () => {}, minIntervalMs: 0 });
    expect(await llm.generate(req)).toBe("B");
    expect(await llm.generate(req)).toBe("B");
    expect(a.generate).toHaveBeenCalledTimes(1); // second call skipped during cooldown
    t = 31_000;
    await llm.generate(req);
    expect(a.generate).toHaveBeenCalledTimes(2); // retried after cooldown
  });

  it("throws LLMUnavailableError when all providers fail or none exist", async () => {
    const llm = new ResilientLLM([flaky("a"), flaky("b")], { sleep: async () => {}, minIntervalMs: 0 });
    await expect(llm.generate(req)).rejects.toBeInstanceOf(LLMUnavailableError);
    await expect(new ResilientLLM([]).generate(req)).rejects.toBeInstanceOf(LLMUnavailableError);
  });

  it("does not swallow non-transient errors", async () => {
    const bad: LLM = { name: "bad", generate: vi.fn().mockRejectedValue(new Error("400 bad key")) };
    const llm = new ResilientLLM([bad, ok("b", "B")], { sleep: async () => {} });
    await expect(llm.generate(req)).rejects.toThrow("400 bad key");
  });

  it("spaces concurrent calls to the same provider", async () => {
    const sleeps: number[] = [];
    const llm = new ResilientLLM([ok("a", "A")], {
      now: () => 0,
      minIntervalMs: 4000,
      sleep: async (ms) => void sleeps.push(ms),
    });
    await Promise.all([llm.generate(req), llm.generate(req), llm.generate(req)]);
    expect(sleeps).toEqual([4000, 8000]);
  });
});
