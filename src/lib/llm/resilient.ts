import { LLMTransientError, LLMUnavailableError, type LLM, type LLMRequest } from "./types";

export interface ResilientOptions {
  /** Minimum gap between calls to the same provider (Gemini free tier ~15 RPM => 4000). */
  minIntervalMs?: number;
  /** How long a provider is skipped after a transient failure. */
  cooldownMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Tries providers in order with per-provider spacing (a simple rate limiter that
 * serialises concurrent callers) and a cooldown after rate-limit/5xx errors.
 * Throws LLMUnavailableError when none can answer so callers can degrade.
 */
export class ResilientLLM implements LLM {
  readonly name = "resilient";
  private readonly minIntervalMs: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly nextSlot = new Map<string, number>();
  private readonly coolUntil = new Map<string, number>();

  constructor(
    private readonly providers: LLM[],
    opts: ResilientOptions = {},
  ) {
    this.minIntervalMs = opts.minIntervalMs ?? 4000;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Reserve the next slot synchronously so parallel callers queue up in order. */
  private async acquire(provider: string): Promise<void> {
    const t = this.now();
    const slot = Math.max(t, this.nextSlot.get(provider) ?? 0);
    this.nextSlot.set(provider, slot + this.minIntervalMs);
    if (slot > t) await this.sleep(slot - t);
  }

  async generate(req: LLMRequest): Promise<string> {
    const errors: string[] = [];
    for (const p of this.providers) {
      if ((this.coolUntil.get(p.name) ?? 0) > this.now()) {
        errors.push(`${p.name}: cooling down`);
        continue;
      }
      await this.acquire(p.name);
      try {
        return await p.generate(req);
      } catch (err) {
        if (err instanceof LLMTransientError) {
          this.coolUntil.set(p.name, this.now() + (err.retryAfterMs ?? this.cooldownMs));
          errors.push(err.message);
          continue;
        }
        throw err;
      }
    }
    throw new LLMUnavailableError(`No LLM provider available (${errors.join("; ") || "none configured"})`);
  }
}
