import { Logger } from "@nestjs/common";

import { LlmJsonRequest, LlmProvider, LlmStructuredRequest } from "./llm-provider.interface";

export interface NamedLlmProvider {
  name: string;
  provider: LlmProvider;
}

/** Tenta os providers em ordem (ex.: Gemini → Anthropic); segue para o próximo se um falhar. */
export class FallbackLlmProvider implements LlmProvider {
  private readonly logger = new Logger(FallbackLlmProvider.name);

  constructor(private readonly providers: NamedLlmProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackLlmProvider requires at least one provider");
    }
  }

  generateStructured(request: LlmStructuredRequest, signal?: AbortSignal): Promise<unknown> {
    return this.runWithFallback((provider) => provider.generateStructured(request, signal));
  }

  generateJson(request: LlmJsonRequest, signal?: AbortSignal): Promise<string> {
    return this.runWithFallback((provider) => provider.generateJson(request, signal));
  }

  private async runWithFallback<T>(call: (provider: LlmProvider) => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let index = 0; index < this.providers.length; index += 1) {
      const { name, provider } = this.providers[index];
      const isLast = index === this.providers.length - 1;

      try {
        return await call(provider);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`[LLM] ${name} failed: ${lastError.message}`);

        if (!isLast) {
          const nextName = this.providers[index + 1].name;
          this.logger.warn(`[LLM] Switching to ${nextName}`);
        }
      }
    }

    this.logger.error(`[LLM] All providers failed. Final provider attempted: ${this.providers[this.providers.length - 1].name}`);
    throw lastError;
  }
}
