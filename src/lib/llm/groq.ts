import { LLMTransientError, type LLM, type LLMRequest } from "./types";

export const GROQ_MODEL = "llama-3.3-70b-versatile";

/** Groq's OpenAI-compatible chat API, used as the fallback when Gemini is rate-limited. */
export class GroqLLM implements LLM {
  readonly name = "groq";

  constructor(
    private readonly apiKey: string,
    private readonly model: string = GROQ_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(req: LLMRequest): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          temperature: req.temperature ?? 0.7,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "system", content: req.system }, ...req.turns],
        }),
      });
    } catch (err) {
      throw new LLMTransientError(`Groq network error: ${(err as Error).message}`, this.name);
    }
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get("retry-after"));
      throw new LLMTransientError(`Groq HTTP ${res.status}`, this.name, Number.isFinite(ra) && ra > 0 ? ra * 1000 : undefined);
    }
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new LLMTransientError("Groq returned no content", this.name);
    return text;
  }
}
