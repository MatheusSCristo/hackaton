import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";

import { LlmJsonRequest, LlmProvider, LlmStructuredRequest } from "./llm-provider.interface";
import { parseLlmJson } from "./llm-json-parser";
import { LlmTimeoutException } from "./exceptions/llm-timeout.exception";
import { LlmRateLimitedException } from "./exceptions/llm-rate-limited.exception";
import { LlmProviderUnavailableException } from "./exceptions/llm-provider-unavailable.exception";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

@Injectable()
export class GeminiProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenerativeAI | null;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>("GEMINI_API_KEY");
    this.model = config.get<string>("GEMINI_MODEL") || DEFAULT_MODEL;
    this.timeoutMs = Number(config.get<string>("GEMINI_TIMEOUT_MS")) || 45_000;
    this.client = apiKey ? new GoogleGenerativeAI(apiKey) : null;
  }

  async generateStructured(request: LlmStructuredRequest, signal?: AbortSignal): Promise<unknown> {
    if (!this.client) {
      throw new LlmProviderUnavailableException("GEMINI_API_KEY não configurada");
    }

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: request.systemPrompt,
      generationConfig: { responseMimeType: "application/json" },
    });

    // O Gemini não tem "tool use forçado" como a Anthropic — descrevemos o
    // schema desejado como parte do prompt e validamos a saída depois.
    const prompt = [
      request.userPrompt,
      "",
      "Responda ESTRITAMENTE em JSON válido (sem markdown, sem texto fora do JSON), seguindo este formato:",
      JSON.stringify(request.inputSchema),
    ].join("\n");

    this.logger.log(`Sending generation request to Gemini${request.label ? ` (${request.label})` : ""}`);

    try {
      const result = await model.generateContent(prompt, { timeout: this.timeoutMs, signal });
      this.logUsage(request.label, result.response.usageMetadata);
      return parseLlmJson(result.response.text());
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  /**
   * Geração livre (sem tool use). O Gemini não tem busca web equivalente à
   * `web_search` da Anthropic aqui — `enableWebSearch` é ignorado (mesma
   * limitação documentada no Slide Generator original); a chamada segue
   * como JSON mode simples.
   */
  async generateJson(request: LlmJsonRequest, signal?: AbortSignal): Promise<string> {
    if (!this.client) {
      throw new LlmProviderUnavailableException("GEMINI_API_KEY não configurada");
    }

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: request.systemPrompt,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = [
      request.userPrompt,
      "",
      "Responda ESTRITAMENTE em JSON válido (sem markdown, sem texto fora do JSON), seguindo este formato:",
      JSON.stringify(request.inputSchema),
    ].join("\n");

    this.logger.log(`Sending free-form generation request to Gemini${request.label ? ` (${request.label})` : ""}`);

    try {
      const result = await model.generateContent(prompt, { timeout: this.timeoutMs, signal });
      this.logUsage(request.label, result.response.usageMetadata);
      return result.response.text();
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  private classifyError(error: unknown): Error {
    if (error instanceof GoogleGenerativeAIFetchError) {
      if (error.status === 429) {
        const retryAfterMs = this.extractRetryAfterMs(error);
        const quotaExhaustedForDay = this.isDailyQuotaExceeded(error);
        this.logger.warn(
          `Gemini rate limit hit (429)${retryAfterMs ? `, retry-after=${retryAfterMs}ms` : ""}${quotaExhaustedForDay ? " [daily quota exhausted]" : ""}`,
        );
        return new LlmRateLimitedException(error.message, retryAfterMs, quotaExhaustedForDay);
      }

      if (error.status && error.status >= 500) {
        this.logger.warn(`Gemini returned a transient server error (${error.status}): ${error.message}`);
        return new LlmProviderUnavailableException(error.message);
      }

      this.logger.error(`Gemini returned a non-retryable error (${error.status}): ${error.message}`);
      return new LlmProviderUnavailableException(error.message);
    }

    if (this.isAbortOrTimeoutError(error)) {
      this.logger.error(`Gemini request timed out after ${this.timeoutMs}ms`);
      return new LlmTimeoutException(this.timeoutMs);
    }

    const reason = error instanceof Error ? error.message : "unknown error";
    this.logger.error(`Unexpected Gemini error: ${reason}`);
    return new LlmProviderUnavailableException(reason);
  }

  private logUsage(
    label: string | undefined,
    usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined,
  ): void {
    if (!usage) return;
    this.logger.log(
      `[token-usage] label=${label ?? "unlabeled"} model=${this.model} promptTokens=${usage.promptTokenCount ?? 0} completionTokens=${usage.candidatesTokenCount ?? 0} totalTokens=${usage.totalTokenCount ?? 0}`,
    );
  }

  private isAbortOrTimeoutError(error: unknown): boolean {
    return error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message));
  }

  private isDailyQuotaExceeded(error: GoogleGenerativeAIFetchError): boolean {
    const quotaFailure = error.errorDetails?.find(
      (detail) => typeof detail["@type"] === "string" && detail["@type"]!.includes("QuotaFailure"),
    ) as { violations?: Array<{ quotaId?: string }> } | undefined;

    return (quotaFailure?.violations ?? []).some((violation) => /PerDay/i.test(violation.quotaId ?? ""));
  }

  private extractRetryAfterMs(error: GoogleGenerativeAIFetchError): number | undefined {
    const retryInfo = error.errorDetails?.find((detail) => typeof detail["@type"] === "string" && detail["@type"]!.includes("RetryInfo"));
    const retryDelay = (retryInfo as { retryDelay?: string } | undefined)?.retryDelay;

    if (typeof retryDelay !== "string") return undefined;

    const seconds = parseFloat(retryDelay.replace(/s$/, ""));
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
  }
}
