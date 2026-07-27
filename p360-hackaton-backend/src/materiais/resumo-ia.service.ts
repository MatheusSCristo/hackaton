import { Injectable } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";

import { IaJsonService } from "./ia-json.service";
import { resumoSchema } from "./schemas";
import type { Apresentacao, Resumo } from "./schemas";
import { ContextoAulaService } from "./contexto-aula.service";
import type { ContextoAula } from "./contexto-aula.service";
import { serializarSlides } from "./simulado-ia.service";

const TOOL_NAME = "registrar_resumo";

/** Prompt portado do `summary-prompt-builder` do projeto de origem. */
const SYSTEM_PROMPT = [
  "Você transforma o conteúdo de uma aula em um material de estudo para o aluno.",
  "Não invente fatos: apenas reorganize e desenvolva o material fornecido.",
  "NUNCA repita cada tópico como uma frase isolada — sintetize em parágrafos que conectem as ideias.",
  "Cada seção tem um título e de 1 a 4 parágrafos.",
  "Use `callout` apenas quando um fato, alerta ou definição merecer destaque.",
  "Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

const INPUT_SCHEMA: Anthropic.Tool["input_schema"] = {
  type: "object",
  properties: {
    title: { type: "string" },
    introduction: {
      type: "string",
      description: "Parágrafo de abertura que situa o tema.",
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          paragraphs: {
            type: "array",
            description: "1 a 4 parágrafos desenvolvidos.",
            items: { type: "string" },
          },
          callout: {
            type: "string",
            description: "Destaque opcional (fato, alerta, definição).",
          },
        },
        required: ["heading", "paragraphs"],
      },
    },
    closing: { type: "string", description: "Fechamento opcional." },
  },
  required: ["title", "introduction", "sections"],
};

@Injectable()
export class ResumoIaService {
  constructor(
    private readonly ia: IaJsonService,
    private readonly contexto: ContextoAulaService,
  ) {}

  async gerar(
    ctx: ContextoAula,
    apresentacao?: Apresentacao | null,
  ): Promise<Resumo> {
    const partes = [this.contexto.descrever(ctx)];

    if (apresentacao) {
      partes.push(
        "",
        "Conteúdo da aula (use como fonte):",
        serializarSlides(apresentacao),
      );
    }

    partes.push("", `Idioma de todo o conteúdo: ${ctx.idioma}.`);

    return this.ia.gerar({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: partes.join("\n"),
      toolName: TOOL_NAME,
      toolDescription: "Registra o resumo da aula para os alunos.",
      inputSchema: INPUT_SCHEMA,
      schema: resumoSchema,
    });
  }
}
