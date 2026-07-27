import { Logger } from "@nestjs/common";

import { LlmJsonRequest, LlmProvider, LlmStructuredRequest } from "./llm-provider.interface";
import { LlmProviderUnavailableException } from "./exceptions/llm-provider-unavailable.exception";
import { LlmRateLimitedException } from "./exceptions/llm-rate-limited.exception";

export interface LlmRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const JITTER_RATIO = 0.2;

export class RetryableLlmProvider implements LlmProvider {
  private readonly logger = new Logger(RetryableLlmProvider.name);

  constructor(
    private readonly inner: LlmProvider,
    private readonly config: LlmRetryConfig,
  ) {}

  generateStructured(request: LlmStructuredRequest, signal?: AbortSignal): Promise<unknown> {
    return this.runWithRetry((s) => this.inner.generateStructured(request, s), signal);
  }

  generateJson(request: LlmJsonRequest, signal?: AbortSignal): Promise<string> {
    return this.runWithRetry((s) => this.inner.generateJson(request, s), signal);
  }

  private async runWithRetry<T>(call: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      if (attempt > 0) {
        const delayMs = this.computeDelay(attempt, lastError);
        this.logger.warn(
          `Retrying LLM request (attempt ${attempt}/${this.config.maxRetries}) in ${Math.round(delayMs)}ms — reason: ${lastError?.message}`,
        );
        await this.sleep(delayMs, signal);
      }

      try {
        const result = await call(signal);
        if (attempt > 0) {
          this.logger.log(`LLM request succeeded after ${attempt} retr${attempt === 1 ? "y" : "ies"}`);
        }
        return result;
      } catch (error) {
        if (!this.isRetryable(error)) {
          throw error;
        }
        lastError = error as Error;
      }
    }

    this.logger.error(`LLM request failed after ${this.config.maxRetries} retries: ${lastError?.message}`);
    throw lastError;
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof LlmRateLimitedException) {
      return !error.quotaExhaustedForDay;
    }
    return error instanceof LlmProviderUnavailableException;
  }

  private computeDelay(attempt: number, error: Error | undefined): number {
    if (error instanceof LlmRateLimitedException && error.retryAfterMs) {
      return error.retryAfterMs;
    }

    const exponential = this.config.baseDelayMs * 2 ** (attempt - 1);
    const capped = Math.min(exponential, this.config.maxDelayMs);
    const jitter = capped * JITTER_RATIO * Math.random();
    return capped + jitter;
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);

      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new Error("LLM request aborted while waiting to retry"));
        },
        { once: true },
      );
    });
  }
}
