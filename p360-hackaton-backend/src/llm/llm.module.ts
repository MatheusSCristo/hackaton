import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { GeminiProvider } from "./gemini.provider";
import { AnthropicProvider } from "./anthropic.provider";
import { LLM_PROVIDER, LLM_WEB_SEARCH_PROVIDER, LlmProvider } from "./llm-provider.interface";
import { RetryableLlmProvider, LlmRetryConfig } from "./retryable-llm-provider";
import { QueuedLlmProvider } from "./queued-llm-provider";
import { FallbackLlmProvider, NamedLlmProvider } from "./fallback-llm-provider";

function readInt(config: ConfigService, name: string, defaultValue: number): number {
  const raw = config.get<string>(name);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function wrapWithResilience(base: LlmProvider, config: ConfigService, envPrefix: string): LlmProvider {
  const retryConfig: LlmRetryConfig = {
    maxRetries: readInt(config, `${envPrefix}_MAX_RETRIES`, 4),
    baseDelayMs: readInt(config, `${envPrefix}_RETRY_BASE_DELAY_MS`, 5_000),
    maxDelayMs: readInt(config, `${envPrefix}_RETRY_MAX_DELAY_MS`, 60_000),
  };
  const concurrency = readInt(config, `${envPrefix}_CONCURRENCY`, 3);

  return new QueuedLlmProvider(new RetryableLlmProvider(base, retryConfig), concurrency);
}

/**
 * Cadeia primário/fallback de providers de LLM (Gemini + Anthropic).
 * `PRIMARY_LLM_PROVIDER`/`FALLBACK_LLM_PROVIDER` seguem o mesmo padrão do
 * `projeto-hackathon` — default é Gemini primário (mais barato) com
 * Anthropic como rede de segurança.
 */
@Global()
@Module({
  providers: [
    GeminiProvider,
    AnthropicProvider,
    {
      provide: LLM_PROVIDER,
      useFactory: (config: ConfigService, gemini: GeminiProvider, anthropic: AnthropicProvider) => {
        const registry: Record<string, NamedLlmProvider> = {
          gemini: { name: "Gemini", provider: wrapWithResilience(gemini, config, "GEMINI") },
          anthropic: { name: "Anthropic", provider: wrapWithResilience(anthropic, config, "ANTHROPIC") },
        };

        const primaryKey = config.get<string>("PRIMARY_LLM_PROVIDER") || "gemini";
        const fallbackKey = config.get<string>("FALLBACK_LLM_PROVIDER") || "anthropic";

        const chain: NamedLlmProvider[] = [];
        if (registry[primaryKey]) chain.push(registry[primaryKey]);
        if (fallbackKey !== "none" && fallbackKey !== primaryKey && registry[fallbackKey]) {
          chain.push(registry[fallbackKey]);
        }
        if (chain.length === 0) {
          chain.push(registry.gemini, registry.anthropic);
        }

        return new FallbackLlmProvider(chain);
      },
      inject: [ConfigService, GeminiProvider, AnthropicProvider],
    },
    {
      provide: LLM_WEB_SEARCH_PROVIDER,
      useFactory: (config: ConfigService, gemini: GeminiProvider, anthropic: AnthropicProvider) => {
        // Anthropic sempre primeiro aqui: é o único provider com busca web
        // real (ver LLM_WEB_SEARCH_PROVIDER). Gemini entra só como
        // degradação caso a Anthropic não esteja configurada.
        return new FallbackLlmProvider([
          { name: "Anthropic", provider: wrapWithResilience(anthropic, config, "ANTHROPIC") },
          { name: "Gemini", provider: wrapWithResilience(gemini, config, "GEMINI") },
        ]);
      },
      inject: [ConfigService, GeminiProvider, AnthropicProvider],
    },
  ],
  exports: [LLM_PROVIDER, LLM_WEB_SEARCH_PROVIDER],
})
export class LlmModule {}
