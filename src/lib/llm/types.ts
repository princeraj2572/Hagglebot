export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system: string;
  turns: ChatTurn[];
  /** Ask the model for a JSON object (best-effort; callers still validate). */
  json?: boolean;
  temperature?: number;
}

export interface LLM {
  readonly name: string;
  generate(req: LLMRequest): Promise<string>;
}

/** Thrown when a provider is temporarily unusable (rate limit, 5xx, network). */
export class LLMTransientError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMTransientError";
  }
}

/** Thrown when every provider failed; callers fall back to templates. */
export class LLMUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}
