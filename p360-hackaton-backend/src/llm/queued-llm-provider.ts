import { Logger } from "@nestjs/common";

import { LlmJsonRequest, LlmProvider, LlmStructuredRequest } from "./llm-provider.interface";

/** Limita a concorrência de chamadas ao provider (evita estourar rate limit em picos). */
export class QueuedLlmProvider implements LlmProvider {
  private readonly logger = new Logger(QueuedLlmProvider.name);
  private activeCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly inner: LlmProvider,
    private readonly concurrency: number,
  ) {}

  generateStructured(request: LlmStructuredRequest, signal?: AbortSignal): Promise<unknown> {
    return this.runQueued(() => this.inner.generateStructured(request, signal));
  }

  generateJson(request: LlmJsonRequest, signal?: AbortSignal): Promise<string> {
    return this.runQueued(() => this.inner.generateJson(request, signal));
  }

  private async runQueued<T>(call: () => Promise<T>): Promise<T> {
    const queuedAt = Date.now();
    await this.acquire();

    const waitMs = Date.now() - queuedAt;
    if (waitMs > 10) {
      this.logger.log(`LLM request waited ${waitMs}ms in queue (concurrency=${this.concurrency})`);
    }

    try {
      return await call();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.activeCount < this.concurrency) {
      this.activeCount += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.activeCount += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.activeCount -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
