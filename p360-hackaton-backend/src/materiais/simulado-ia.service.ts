import { Injectable } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";

import { IaJsonService } from "./ia-json.service";
import { MAX_QUESTOES, MIN_QUESTOES, simuladoSchema } from "./schemas";
import type { Apresentacao, Simulado } from "./schemas";
import { ContextoAulaService } from "./contexto-aula.service";
import type { ContextoAula } from "./contexto-aula.service";

const N_QUESTOES_PADRAO = 5;
const TOOL_NAME = "registrar_simulado";

/**
 * Prompt portado do `MedicalQuizPromptTemplate` do projeto de origem — inclusive
 * a referência ao estilo Enamed e as regras de qualidade das alternativas, que
 * são o que separa uma questão de prova de um teste trivial.
 */
const SYSTEM_PROMPT = [
  "Você é especialista em educação médica e elabora questões de múltipla escolha.",
  "As questões devem ter o nível de exames brasileiros como o Enamed, exigindo RACIOCÍNIO CLÍNICO em vez de memorização.",
  "Cada questão tem exatamente 4 alternativas (A, B, C, D) e apenas UMA correta.",
  "As alternativas incorretas devem ser plausíveis — erros que estudantes realmente cometem —",
  "com estrutura gramatical e comprimento semelhantes entre si.",
  "NUNCA use 'todas as anteriores', 'nenhuma das anteriores' ou 'A e B estão corretas'.",
  "Distribua a letra correta aleatoriamente entre as questões (não concentre em uma letra).",
  "Escreva `isCorrect` explicitamente em TODAS as alternativas, inclusive as falsas.",
  "`explanationCorrect` explica por que a correta está certa e é campo irmão de `alternatives` — nunca dentro de uma alternativa.",
  "Em cada alternativa incorreta, use `explanationIfIncorrect` para explicar o erro.",
  "Baseie-se apenas no contexto fornecido; se houver dificuldades da turma, foque nelas.",
  "Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

const INPUT_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título do simulado." },
    questions: {
      type: "array",
      description: "Questões na ordem de aplicação.",
      items: {
        type: "object",
        properties: {
          statement: { type: "string", description: "Enunciado da questão." },
          alternatives: {
            type: "array",
            description: "Exatamente 4 alternativas, uma correta.",
            items: {
              type: "object",
              properties: {
                label: { type: "string", enum: ["A", "B", "C", "D"] },
                text: { type: "string" },
                isCorrect: { type: "boolean" },
                explanationIfIncorrect: {
                  type: "string",
                  description: "Por que esta alternativa está errada.",
                },
              },
              required: ["label", "text", "isCorrect"],
            },
          },
          explanationCorrect: {
            type: "string",
            description: "Por que a alternativa correta está certa.",
          },
          competency: {
            type: "string",
            description: "Competência avaliada (ex.: conduta, diagnóstico).",
          },
          difficulty: {
            type: "string",
            description: "facil | media | dificil",
          },
          technicalReference: {
            type: "string",
            description: "Referência técnica (diretriz, consenso).",
          },
        },
        required: ["statement", "alternatives", "explanationCorrect"],
      },
    },
  },
  required: ["title", "questions"],
};

@Injectable()
export class SimuladoIaService {
  constructor(
    private readonly ia: IaJsonService,
    private readonly contexto: ContextoAulaService,
  ) {}

  /**
   * Gera o simulado. Quando a aula já tem slides gerados, eles entram como
   * fonte — assim o simulado cobre o que foi efetivamente apresentado.
   */
  async gerar(
    ctx: ContextoAula,
    apresentacao?: Apresentacao | null,
  ): Promise<Simulado> {
    const total = Math.min(
      MAX_QUESTOES,
      Math.max(MIN_QUESTOES, ctx.nQuestoes ?? N_QUESTOES_PADRAO),
    );

    const partes = [this.contexto.descrever(ctx)];

    if (apresentacao) {
      partes.push(
        "",
        "Conteúdo apresentado nos slides (use como fonte principal):",
        serializarSlides(apresentacao),
      );
    }

    partes.push(
      "",
      `Gere exatamente ${total} ${total === 1 ? "questão" : "questões"} de múltipla escolha.`,
      `Idioma de todo o conteúdo: ${ctx.idioma}.`,
    );

    return this.ia.gerar({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: partes.join("\n"),
      toolName: TOOL_NAME,
      toolDescription: "Registra o simulado gerado para a aula.",
      inputSchema: INPUT_SCHEMA,
      schema: simuladoSchema,
    });
  }
}

/** Serializa os slides de desenvolvimento como fonte para as questões. */
export function serializarSlides(apresentacao: Apresentacao): string {
  const linhas = [`Título: ${apresentacao.title}`];
  apresentacao.slides
    .filter((slide) => slide.role === "development")
    .forEach((slide, index) => {
      linhas.push(`${index + 1}. ${slide.title} — ${slide.content.join("; ")}`);
    });
  return linhas.join("\n");
}
