import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic, { APIConnectionTimeoutError, APIError, RateLimitError } from "@anthropic-ai/sdk";

import { LlmJsonRequest, LlmProvider, LlmStructuredRequest } from "./llm-provider.interface";
import { LlmTimeoutException } from "./exceptions/llm-timeout.exception";
import { LlmRateLimitedException } from "./exceptions/llm-rate-limited.exception";
import { LlmProviderUnavailableException } from "./exceptions/llm-provider-unavailable.exception";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 8000;
const JSON_PREFILL = "{";
const WEB_SEARCH_MAX_USES = 8;
const WEB_SEARCH_TIMEOUT_MS = 60_000;

/** Fallback do Gemini — saída estruturada via tool use forçado (robusto em qualquer versão do SDK). */
@Injectable()
export class AnthropicProvider implements LlmProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>("ANTHROPIC_API_KEY");
    this.model = config.get<string>("ANTHROPIC_MODEL") || DEFAULT_MODEL;
    this.timeoutMs = Number(config.get<string>("ANTHROPIC_TIMEOUT_MS")) || 45_000;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async generateStructured(request: LlmStructuredRequest, signal?: AbortSignal): Promise<unknown> {
    if (!this.client) {
      throw new LlmProviderUnavailableException("ANTHROPIC_API_KEY não configurada");
    }

    const tool: Anthropic.Tool = {
      name: request.toolName,
      description: request.toolDescription,
      input_schema: request.inputSchema as Anthropic.Tool["input_schema"],
    };

    this.logger.log(`Sending generation request to Anthropic${request.label ? ` (${request.label})` : ""}`);

    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.systemPrompt,
          tools: [tool],
          tool_choice: { type: "tool", name: request.toolName },
          messages: [{ role: "user", content: request.userPrompt }],
        },
        { signal },
      );

      this.logUsage(request.label, response.usage);

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === request.toolName,
      );
      return toolUse?.input ?? {};
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  /**
   * Geração livre (sem tool use forçado) — necessária pra habilitar a tool
   * `web_search`, que a Anthropic não permite combinar com `tool_choice`
   * forçado. Sem busca web, usamos o truque de "JSON prefill": o assistant
   * já começa a resposta com `{`, o que força a saída a ser JSON puro sem
   * depender de tool use.
   */
  async generateJson(request: LlmJsonRequest, signal?: AbortSignal): Promise<string> {
    if (!this.client) {
      throw new LlmProviderUnavailableException("ANTHROPIC_API_KEY não configurada");
    }

    const useWebSearch = Boolean(request.enableWebSearch);
    this.logger.log(
      `Sending free-form generation request to Anthropic${useWebSearch ? " (web search enabled)" : ""}${request.label ? ` (${request.label})` : ""}`,
    );

    const formatoEsperado = [
      "",
      "Responda ESTRITAMENTE em JSON válido (sem markdown, sem texto fora do JSON), seguindo este formato:",
      JSON.stringify(request.inputSchema),
    ].join("\n");

    try {
      const message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.systemPrompt,
          messages: useWebSearch
            ? [{ role: "user", content: request.userPrompt + formatoEsperado }]
            : [
                { role: "user", content: request.userPrompt + formatoEsperado },
                { role: "assistant", content: JSON_PREFILL },
              ],
          ...(useWebSearch
            ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: WEB_SEARCH_MAX_USES }] }
            : {}),
        },
        { timeout: useWebSearch ? WEB_SEARCH_TIMEOUT_MS : this.timeoutMs, signal },
      );

      this.logUsage(request.label, message.usage);

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");

      if (!text) {
        throw new LlmProviderUnavailableException("Anthropic response did not contain a text block");
      }

      return useWebSearch ? text : JSON_PREFILL + text;
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  private classifyError(error: unknown): Error {
    if (error instanceof RateLimitError) {
      const retryAfterMs = this.extractRetryAfterMs(error);
      this.logger.warn(`Anthropic rate limit hit (429)${retryAfterMs ? `, retry-after=${retryAfterMs}ms` : ""}`);
      return new LlmRateLimitedException(error.message, retryAfterMs);
    }

    if (error instanceof APIConnectionTimeoutError) {
      this.logger.error(`Anthropic request timed out after ${this.timeoutMs}ms`);
      return new LlmTimeoutException(this.timeoutMs);
    }

    if (error instanceof APIError) {
      if (error.status && error.status >= 500) {
        this.logger.warn(`Anthropic returned a transient server error (${error.status}): ${error.message}`);
        return new LlmProviderUnavailableException(error.message);
      }
      this.logger.error(`Anthropic returned a non-retryable error (${error.status}): ${error.message}`);
      return new LlmProviderUnavailableException(error.message);
    }

    if (error instanceof LlmProviderUnavailableException) {
      return error;
    }

    const reason = error instanceof Error ? error.message : "unknown error";
    this.logger.error(`Unexpected Anthropic error: ${reason}`);
    return new LlmProviderUnavailableException(reason);
  }

  private logUsage(label: string | undefined, usage: { input_tokens?: number; output_tokens?: number } | undefined): void {
    if (!usage) return;
    const totalTokens = (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
    this.logger.log(
      `[token-usage] label=${label ?? "unlabeled"} model=${this.model} promptTokens=${usage.input_tokens ?? 0} completionTokens=${usage.output_tokens ?? 0} totalTokens=${totalTokens}`,
    );
  }

  private extractRetryAfterMs(error: RateLimitError): number | undefined {
    const retryAfterHeader = error.headers?.get("retry-after");
    if (!retryAfterHeader) return undefined;
    const seconds = parseFloat(retryAfterHeader);
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
  }
}
