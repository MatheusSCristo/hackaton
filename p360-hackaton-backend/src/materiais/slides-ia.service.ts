import { Injectable } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";

import { IaJsonService } from "./ia-json.service";
import {
  apresentacaoSchema,
  MAX_BULLETS_PER_SLIDE,
  MAX_SLIDES,
  MIN_SLIDES,
} from "./schemas";
import type { Apresentacao } from "./schemas";
import type { ContextoAula } from "./contexto-aula.service";
import { ContextoAulaService } from "./contexto-aula.service";

const N_SLIDES_PADRAO = 8;
const TOOL_NAME = "registrar_apresentacao";

/**
 * Prompt portado do "Slide Generator", com duas adaptações:
 * removida a exigência de imagem por slide (não resolvemos imagens ainda) e
 * acrescentada a instrução de partir do contexto da aula em vez de um tema solto.
 */
const SYSTEM_PROMPT = [
  "Você monta apresentações de aula para ensino médico.",
  "Receba o contexto da aula (caso clínico ou tema, público, objetivos) e produza os slides.",
  "MANTENHA-SE ESTRITAMENTE NO TEMA: não introduza assuntos que não decorram do contexto.",
  "Quebre o tema em facetas distintas — cada slide de desenvolvimento cobre UMA faceta, sem repetir as outras.",
  "O primeiro slide é a capa (role=introduction) e o último é o fechamento (role=conclusion):",
  "ambos são minimalistas, com título e subtítulo, e `content` VAZIO.",
  `Slides do meio têm role=development e de 3 a ${MAX_BULLETS_PER_SLIDE} tópicos em \`content\`.`,
  "Cada tópico é uma frase curta (menos de 12 palavras, no máximo 160 caracteres) — não escreva parágrafos.",
  "Em `speakerNotes`, escreva o que o professor deve falar naquele slide (menos de 1400 caracteres).",
  "Se o contexto trouxer dificuldades da turma, priorize-as nos slides de desenvolvimento.",
  "Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

const INPUT_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  properties: {
    title: { type: "string", description: "Título da apresentação." },
    subtitle: { type: "string", description: "Subtítulo da capa." },
    slides: {
      type: "array",
      description:
        "Slides na ordem de apresentação: capa, desenvolvimento(s), fechamento.",
      items: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["introduction", "development", "conclusion"],
          },
          title: { type: "string" },
          subtitle: { type: "string" },
          content: {
            type: "array",
            description:
              "Tópicos do slide. Vazio em introduction e conclusion.",
            items: { type: "string" },
          },
          speakerNotes: {
            type: "string",
            description: "Roteiro de fala do professor para este slide.",
          },
        },
        required: ["role", "title", "content"],
      },
    },
  },
  required: ["title", "slides"],
};

@Injectable()
export class SlidesIaService {
  constructor(
    private readonly ia: IaJsonService,
    private readonly contexto: ContextoAulaService,
  ) {}

  async gerar(ctx: ContextoAula): Promise<Apresentacao> {
    const total = Math.min(
      MAX_SLIDES,
      Math.max(MIN_SLIDES, ctx.nSlides ?? N_SLIDES_PADRAO),
    );

    const userPrompt = [
      this.contexto.descrever(ctx),
      "",
      `Gere exatamente ${total} slides: 1 de introdução, ${total - 2} de desenvolvimento e 1 de conclusão.`,
      `Idioma de todo o conteúdo: ${ctx.idioma}.`,
    ].join("\n");

    return this.ia.gerar({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      toolName: TOOL_NAME,
      toolDescription: "Registra a apresentação gerada para a aula.",
      inputSchema: INPUT_SCHEMA,
      schema: apresentacaoSchema,
    });
  }
}
