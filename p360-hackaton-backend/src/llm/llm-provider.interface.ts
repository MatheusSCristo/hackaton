import type { ConfigService } from "@nestjs/config";

export const LLM_PROVIDER = Symbol("LLM_PROVIDER");
/**
 * Cadeia dedicada a gerações com `enableWebSearch`. A Anthropic é sempre a
 * primeira opção aqui (é a única que faz busca web de verdade); o Gemini
 * entra só como degradação (gera sem pesquisar) se a Anthropic não estiver
 * configurada/disponível. Independente do `PRIMARY_LLM_PROVIDER` normal, que
 * prioriza custo (Gemini) para os demais materiais.
 */
export const LLM_WEB_SEARCH_PROVIDER = Symbol("LLM_WEB_SEARCH_PROVIDER");

/** Descrição da saída estruturada esperada (mesmo shape do `Anthropic.Tool["input_schema"]`). */
export interface LlmJsonSchema {
  type: string;
  description?: string;
  properties?: Record<string, LlmJsonSchema>;
  items?: LlmJsonSchema;
  enum?: string[];
  required?: string[];
  [key: string]: unknown;
}

export interface LlmStructuredRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Nome da "tool"/ação — usado pelo tool use forçado da Anthropic. */
  toolName: string;
  toolDescription: string;
  inputSchema: LlmJsonSchema;
  maxTokens?: number;
  /** Usado só em log de uso de tokens. */
  label?: string;
}

/**
 * Pedido de geração livre (sem tool use forçado) — necessário quando o
 * provider precisa de uma ferramenta concorrente (ex.: busca web), que a
 * Anthropic não permite combinar com `tool_choice` forçado. A saída ainda é
 * JSON, mas descrita textualmente no prompt (`inputSchema` como exemplo de
 * formato) em vez de imposta via schema de tool.
 */
export interface LlmJsonRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Formato esperado, embutido no prompt como exemplo (não é imposto como tool). */
  inputSchema: LlmJsonSchema;
  /** Habilita a tool de busca web (só tem efeito real no provider Anthropic). */
  enableWebSearch?: boolean;
  maxTokens?: number;
  label?: string;
}

export interface LlmProvider {
  generateStructured(request: LlmStructuredRequest, signal?: AbortSignal): Promise<unknown>;
  /** Retorna o texto bruto do modelo (ainda não parseado) — usar `parseLlmJson`. */
  generateJson(request: LlmJsonRequest, signal?: AbortSignal): Promise<string>;
}

/** Ao menos uma chave de provider (Gemini ou Anthropic) precisa estar configurada. */
export function isLlmConfigured(config: ConfigService): boolean {
  return Boolean(config.get<string>("GEMINI_API_KEY") || config.get<string>("ANTHROPIC_API_KEY"));
}
