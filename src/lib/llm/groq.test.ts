import { describe, expect, it, vi } from "vitest";
import { GroqLLM } from "./groq";
import { LLMTransientError } from "./types";

const req = { system: "s", turns: [{ role: "user" as const, content: "hi" }] };

describe("GroqLLM", () => {
  it("returns the model text", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }));
    await expect(new GroqLLM("k", "m", f as unknown as typeof fetch).generate(req)).resolves.toBe("ok");
  });

  it("treats a 4xx (retired model, bad key) as a provider failure with a long cooldown, so callers fall back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = vi.fn().mockResolvedValue(new Response('{"error":"model_not_found"}', { status: 404 }));
    const err = await new GroqLLM("k", "gone", f as unknown as typeof fetch).generate(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LLMTransientError);
    expect((err as LLMTransientError).retryAfterMs).toBe(10 * 60_000);
  });
});
