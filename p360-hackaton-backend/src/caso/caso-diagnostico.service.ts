import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isLlmConfigured,
  LLM_PROVIDER,
  LlmJsonSchema,
  LlmProvider,
} from "../llm/llm-provider.interface";
import type { AgregadoCaso } from "./caso-coleta.service";

const TOOL_NAME = "diagnosticar_turma";

export interface PontoFraco {
  titulo: string;
  descricao: string;
  etapa: string;
  severidade: "alta" | "media" | "baixa";
  evidencia: string;
  sugestaoReforco: string;
}

export interface DiagnosticoTurma {
  pontosFracos: PontoFraco[];
  resumo: string;
  /** false = heurística (sem chave Anthropic ou falha na chamada). */
  ia: boolean;
}

const SYSTEM_PROMPT =
  "Você analisa o desempenho de uma turma de medicina em um caso clínico e aponta o que precisa ser reforçado. " +
  "Baseie-se apenas nos dados fornecidos (percentuais por etapa do raciocínio clínico, conclusão, tempos). " +
  "Seja específico e acionável: diga qual etapa/competência falhou e o que o professor deve retomar. " +
  "Não invente números nem diagnósticos que não estejam nos dados. " +
  "Se os dados forem escassos, diga isso no resumo e retorne poucos pontos.";

const DIAGNOSTICAR_SCHEMA: LlmJsonSchema = {
  type: "object",
  properties: {
    pontos_fracos: {
      type: "array",
      description: "Pontos a reforçar, do mais para o menos crítico.",
      items: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Rótulo curto do problema.",
          },
          descricao: { type: "string" },
          etapa: {
            type: "string",
            description:
              "Etapa do raciocínio: anamnese, examefisico, exames, diagnostico ou conduta.",
          },
          severidade: { type: "string", enum: ["alta", "media", "baixa"] },
          evidencia: {
            type: "string",
            description: "O dado que sustenta a conclusão.",
          },
          sugestao_reforco: {
            type: "string",
            description: "O que o professor deve retomar.",
          },
        },
        required: [
          "titulo",
          "descricao",
          "etapa",
          "severidade",
          "evidencia",
          "sugestao_reforco",
        ],
      },
    },
    resumo: { type: "string" },
  },
  required: ["pontos_fracos", "resumo"],
};

/**
 * Converte o agregado do caso em "o que reforçar".
 *
 * É o elo que liga um bloco de caso aos blocos seguintes: o resultado vai para
 * `bloco.output.diagnostico` e alimenta o bloco de reforço e a enquete focada.
 */
@Injectable()
export class CasoDiagnosticoService {
  private readonly logger = new Logger(CasoDiagnosticoService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  async diagnosticar(
    agregado: AgregadoCaso,
    contexto: { casoTitulo?: string | null; publico?: string | null },
  ): Promise<DiagnosticoTurma> {
    if (!isLlmConfigured(this.config)) return heuristica(agregado);

    try {
      const parsed = (await this.llmProvider.generateStructured({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildPrompt(agregado, contexto),
        toolName: TOOL_NAME,
        toolDescription:
          "Registra os pontos fracos da turma e o resumo do desempenho.",
        inputSchema: DIAGNOSTICAR_SCHEMA,
        maxTokens: 2000,
        label: TOOL_NAME,
      })) as {
        pontos_fracos?: unknown;
        resumo?: unknown;
      };

      const pontosFracos = normalizarPontos(parsed.pontos_fracos);
      if (pontosFracos.length === 0) return heuristica(agregado);

      return {
        pontosFracos,
        resumo: typeof parsed.resumo === "string" ? parsed.resumo : "",
        ia: true,
      };
    } catch (error) {
      this.logger.error(
        `Falha no diagnóstico (LLM): ${String(error)} — caindo para heurística.`,
      );
      return heuristica(agregado);
    }
  }
}

function buildPrompt(
  agregado: AgregadoCaso,
  contexto: { casoTitulo?: string | null; publico?: string | null },
): string {
  const linhas: string[] = [];
  if (contexto.casoTitulo) linhas.push(`Caso: ${contexto.casoTitulo}`);
  if (contexto.publico) linhas.push(`Público: ${contexto.publico}`);

  linhas.push(
    "",
    `Alunos na turma: ${agregado.alunosTotal}`,
    `Alunos que interagiram: ${agregado.alunosEngajados} (${agregado.engajamento}%)`,
    `Concluíram o caso: ${agregado.concluidos} (${agregado.taxaConclusao}%)`,
    "",
    "Percentual da turma que passou por cada etapa:",
    ...agregado.etapas.map(
      (e) => `- ${e.label}: ${e.porcentagem}% (${e.alunos} alunos)`,
    ),
  );

  if (agregado.tempos.length > 0) {
    linhas.push(
      "",
      "Tempo médio por etapa (segundos):",
      ...agregado.tempos.map((t) => `- ${t.evento}: ${t.segundos}s`),
    );
  }

  linhas.push(
    "",
    "Aponte o que a turma precisa reforçar. Etapa com percentual baixo e/ou tempo alto indica dificuldade.",
  );
  return linhas.join("\n");
}

function normalizarPontos(raw: unknown): PontoFraco[] {
  if (!Array.isArray(raw)) return [];
  const pontos: PontoFraco[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const titulo = typeof o.titulo === "string" ? o.titulo.trim() : "";
    if (!titulo) continue;

    const severidade =
      o.severidade === "alta" || o.severidade === "baixa"
        ? o.severidade
        : "media";

    pontos.push({
      titulo,
      descricao: typeof o.descricao === "string" ? o.descricao.trim() : "",
      etapa: typeof o.etapa === "string" ? o.etapa.trim() : "",
      severidade,
      evidencia: typeof o.evidencia === "string" ? o.evidencia.trim() : "",
      sugestaoReforco:
        typeof o.sugestao_reforco === "string" ? o.sugestao_reforco.trim() : "",
    });
  }
  return pontos;
}

/**
 * Sem IA: ranqueia as etapas com menor participação. Menos rico, mas honesto —
 * e mantém o encadeamento (reforço/enquete focada) funcionando.
 */
function heuristica(agregado: AgregadoCaso): DiagnosticoTurma {
  const criticas = [...agregado.etapas]
    .filter((e) => e.porcentagem < 70)
    .sort((a, b) => a.porcentagem - b.porcentagem)
    .slice(0, 3);

  return {
    pontosFracos: criticas.map((etapa) => ({
      titulo: `Baixa cobertura em ${etapa.label.toLowerCase()}`,
      descricao: `Apenas ${etapa.porcentagem}% da turma passou por esta etapa.`,
      etapa: etapa.chave,
      severidade:
        etapa.porcentagem < 40
          ? "alta"
          : etapa.porcentagem < 60
            ? "media"
            : "baixa",
      evidencia: `${etapa.alunos} de ${agregado.alunosTotal} alunos.`,
      sugestaoReforco: `Retome ${etapa.label.toLowerCase()} com a turma.`,
    })),
    resumo:
      criticas.length > 0
        ? "Diagnóstico por heurística (sem IA configurada): etapas com menor participação."
        : "A turma cobriu as etapas principais. Sem pontos críticos pela heurística.",
    ia: false,
  };
}
