import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMTransientError, type LLM, type LLMRequest } from "./types";

export const GEMINI_MODEL = "gemini-2.0-flash";

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
      if (status === undefined || status === 429 || status >= 500) {
        throw new LLMTransientError(`Gemini: ${(err as Error).message}`, this.name);
      }
      throw err;
    }
  }
}
