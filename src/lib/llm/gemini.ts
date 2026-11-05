import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMTransientError, type LLM, type LLMRequest } from "./types";

/** A rolling alias, so the default does not go stale when Google retires a dated model. Override with GEMINI_MODEL. */
export const GEMINI_MODEL = "gemini-flash-lite-latest";

export class GeminiLLM implements LLM {
  readonly name = "gemini";
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    private readonly model: string = GEMINI_MODEL,
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generate(req: LLMRequest): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: req.system,
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    });
    try {
      const res = await model.generateContent({
        contents: req.turns.map((t) => ({
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
      });
      return res.response.text();
    } catch (err) {
      const status = (err as { status?: number }).status;
      // Rate limits and outages recover soon. Any other 4xx (retired model, bad key) will not,
      // so skip this provider for longer and say why; the chat then falls back instead of stopping.
      const permanent = status !== undefined && status >= 400 && status < 500 && status !== 429;
      if (permanent) console.warn(`Gemini "${this.model}" failed (HTTP ${status}), falling back: ${(err as Error).message.slice(0, 160)}`);
      throw new LLMTransientError(`Gemini: ${(err as Error).message}`, this.name, permanent ? 10 * 60_000 : undefined);
    }
  }
}
