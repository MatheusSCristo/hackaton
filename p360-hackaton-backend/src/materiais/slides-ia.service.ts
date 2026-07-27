import { Injectable } from "@nestjs/common";
import type { LlmJsonSchema } from "../llm/llm-provider.interface";

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
 * Prompt portado do "Slide Generator", com uma adaptação: parte do contexto
 * da aula (caso clínico ou tema, público, objetivos) em vez de um tema solto.
 * As regras de imagem por slide (`visual`) foram portadas do `PromptBuilder`
 * original — a URL sugerida aqui é só um candidato; quem resolve a imagem
 * final de verdade é o `ImageResolverService` (Unsplash/Wikimedia/Picsum).
 */
const SYSTEM_PROMPT = [
  "Você monta apresentações de aula para ensino médico.",
  "Receba o contexto da aula (caso clínico ou tema, público, objetivos) e produza os slides.",
  "MANTENHA-SE ESTRITAMENTE NO TEMA: não introduza assuntos que não decorram do contexto.",
  "Quebre o tema em facetas distintas — cada slide de desenvolvimento cobre UMA faceta, sem repetir as outras.",
  "O primeiro slide é a capa (role=introduction) e o último é o fechamento (role=conclusion):",
  "ambos são minimalistas, com título e subtítulo, e `content` VAZIO — nunca tenham `visual`.",
  `Slides do meio têm role=development e de 3 a ${MAX_BULLETS_PER_SLIDE} tópicos em \`content\`.`,
  "Cada tópico é uma frase curta (menos de 12 palavras, no máximo 160 caracteres) — não escreva parágrafos.",
  "Todo slide de desenvolvimento precisa de `visual.keyword`: 2 a 6 palavras específicas (não genéricas) que descrevam a imagem ideal para aquele tópico.",
  "Se você souber uma URL real e relevante de imagem (Wikimedia Commons ou Unsplash), inclua em `visual.imageUrl`; se não tiver certeza, OMITA o campo — nunca invente uma URL.",
  "Em `speakerNotes`, escreva o que o professor deve falar naquele slide (menos de 1400 caracteres).",
  "Se o contexto trouxer dificuldades da turma, priorize-as nos slides de desenvolvimento.",
  "Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

const INPUT_SCHEMA: LlmJsonSchema = {
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
          visual: {
            type: "object",
            description:
              "Só em slides de desenvolvimento: sugestão de imagem para o tópico.",
            properties: {
              keyword: {
                type: "string",
                description: "2 a 6 palavras específicas do assunto da imagem.",
              },
              imageUrl: {
                type: "string",
                description:
                  "URL real (Wikimedia Commons/Unsplash) se souber; omitir se não tiver certeza.",
              },
            },
            required: ["keyword"],
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
