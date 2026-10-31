import { GeminiLLM } from "./gemini";
import { GroqLLM } from "./groq";
import { ResilientLLM } from "./resilient";
import type { LLM } from "./types";

export * from "./types";
export { ResilientLLM } from "./resilient";

/** Gemini first, Groq as fallback; with no keys the chain is empty (template mode). */
export function createLLMFromEnv(env: Record<string, string | undefined> = process.env): LLM {
  const providers: LLM[] = [];
  if (env.GEMINI_API_KEY?.trim()) providers.push(new GeminiLLM(env.GEMINI_API_KEY.trim()));
  if (env.GROQ_API_KEY?.trim()) providers.push(new GroqLLM(env.GROQ_API_KEY.trim()));
  return new ResilientLLM(providers);
}
