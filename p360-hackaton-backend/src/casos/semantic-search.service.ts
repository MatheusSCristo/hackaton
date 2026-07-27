import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isLlmConfigured,
  LLM_PROVIDER,
  LlmJsonSchema,
  LlmProvider,
} from "../llm/llm-provider.interface";
import { CasosService } from "./casos.service";
import type { CasoResponseDto } from "./dto/caso-response.dto";

/** Nº máximo de casos do acervo enviados ao modelo como candidatos. */
const MAX_CANDIDATES = 100;
const DEFAULT_LIMIT = 10;

interface RankMatch {
  index: number;
  relevancia: "alta" | "media" | "baixa";
}

const SYSTEM_PROMPT =
  "Você seleciona casos clínicos relevantes para o tema de uma aula. " +
  "Recebe um tema e uma lista numerada de casos (título, especialidade, tema/diagnóstico e descrição). " +
  "Retorne os índices dos casos genuinamente relacionados ao tema, ordenados do mais para o menos relevante, " +
  "cada um com uma classificação de relevância. Considere sinônimos e proximidade clínica " +
  "(ex.: 'dor no peito' relaciona-se a infarto/angina mesmo sem as palavras exatas). " +
  "Não invente índices e não inclua casos sem relação real com o tema. " +
  "Se poucos forem relevantes, retorne poucos.";

const TOOL_NAME = "selecionar_casos";

// Saída estruturada (tool use forçado na Anthropic, JSON mode no Gemini).
const SELECT_SCHEMA: LlmJsonSchema = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      description: "Casos relevantes, ordenados por relevância decrescente.",
      items: {
        type: "object",
        properties: {
          index: {
            type: "integer",
            description: "Índice do caso na lista fornecida.",
          },
          relevancia: { type: "string", enum: ["alta", "media", "baixa"] },
        },
        required: ["index", "relevancia"],
      },
    },
  },
  required: ["matches"],
};

@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly casos: CasosService,
  ) {}

  /** Se a busca semântica (LLM) está disponível. */
  get enabled(): boolean {
    return isLlmConfigured(this.config);
  }

  /**
   * Busca por tema. Com provider de LLM configurado, ranqueia semanticamente
   * o acervo da empresa (rerank por LLM). Sem chave, cai para ILIKE.
   */
  async searchByTheme(
    empId: number,
    tema: string,
    limit = DEFAULT_LIMIT,
  ): Promise<CasoResponseDto[]> {
    const term = tema.trim();
    if (!term) return [];

    if (!this.enabled) {
      const fallback = await this.casos.search(empId, term, 1, limit);
      return fallback.items;
    }

    // Candidatos = catálogo da empresa (sem filtro de texto), limitado.
    const { items } = await this.casos.search(
      empId,
      undefined,
      1,
      MAX_CANDIDATES,
    );
    if (items.length === 0) return [];

    const numbered = items
      .map((c, i) => {
        const desc = c.descricao ? ` — ${c.descricao.slice(0, 160)}` : "";
        return `[${i}] ${c.titulo} — área: ${c.area ?? "?"} — tema: ${c.tema ?? "?"}${desc}`;
      })
      .join("\n");

    try {
      const parsed = (await this.llmProvider.generateStructured({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: `Tema da aula: "${term}"\n\nCasos disponíveis:\n${numbered}`,
        toolName: TOOL_NAME,
        toolDescription:
          "Registra os casos relevantes para o tema, ordenados do mais para o menos relevante.",
        inputSchema: SELECT_SCHEMA,
        maxTokens: 2000,
        label: TOOL_NAME,
      })) as { matches?: RankMatch[] };

      const seen = new Set<string>();
      const ranked: CasoResponseDto[] = [];
      for (const match of parsed.matches ?? []) {
        if (
          !Number.isInteger(match.index) ||
          match.index < 0 ||
          match.index >= items.length
        ) {
          continue;
        }
        if (match.relevancia === "baixa") continue;
        const caso = items[match.index];
        if (seen.has(caso.id)) continue;
        seen.add(caso.id);
        ranked.push(caso);
        if (ranked.length >= limit) break;
      }
      return ranked;
    } catch (error) {
      this.logger.error(
        `Falha na busca semântica (LLM): ${String(error)} — caindo para ILIKE.`,
      );
      const fallback = await this.casos.search(empId, term, 1, limit);
      return fallback.items;
    }
  }
}
