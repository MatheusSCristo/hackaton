export class LlmRateLimitedException extends Error {
  readonly retryAfterMs?: number;
  readonly quotaExhaustedForDay: boolean;

  constructor(reason: string, retryAfterMs?: number, quotaExhaustedForDay = false) {
    super(`LLM provider rate-limited: ${reason}`);
    this.name = "LlmRateLimitedException";
    this.retryAfterMs = retryAfterMs;
    this.quotaExhaustedForDay = quotaExhaustedForDay;
  }
}
