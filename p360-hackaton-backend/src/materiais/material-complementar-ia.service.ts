import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isLlmConfigured,
  LLM_WEB_SEARCH_PROVIDER,
  LlmJsonSchema,
  LlmProvider,
} from "../llm/llm-provider.interface";
import { parseLlmJson } from "../llm/llm-json-parser";
import { ContextoAulaService } from "./contexto-aula.service";
import type { ContextoAula } from "./contexto-aula.service";
import { MAX_REFERENCIAS, materialComplementarSchema, MIN_REFERENCIAS } from "./schemas";
import type { Apresentacao, MaterialComplementar } from "./schemas";
import { serializarSlides } from "./simulado-ia.service";

const TOOL_NAME = "registrar_material_complementar";

/**
 * Prompt portado do `SupplementaryMaterialPromptBuilder` do projeto de
 * origem — inclusive a regra de credibilidade (artigo=PubMed, site=guideline
 * oficial) e a proibição de inventar URL.
 */
const SYSTEM_PROMPT = [
  "Você é um bibliotecário de pesquisa que cura uma lista curta e de alta qualidade de leituras e vídeos para acompanhar uma aula.",
  "Você tem a ferramenta `web_search` disponível. Use-a para achar recursos reais e existentes sobre este tema exato antes de responder — busque a página real do artigo, do vídeo, ou uma página real de livraria/loja para o livro.",
  "REGRA DE CREDIBILIDADE (obrigatória, prioridade máxima): toda referência do tipo \"artigo\" deve ser um artigo real e indexado no PubMed (busque site:pubmed.ncbi.nlm.nih.gov ou ncbi.nlm.nih.gov/pmc) — a \"url\" deve apontar direto para essa página do PubMed/PMC. Toda referência \"site\" deve ser uma diretriz clínica oficial ou fonte institucional (sociedade médica, autoridade de saúde governamental, organização internacional de saúde como OMS/Ministério da Saúde) — nunca um blog genérico, fórum ou site de resumo não oficial.",
  "Se você não encontrar um artigo genuíno do PubMed ou uma página de diretriz oficial verdadeiramente relevante para este tema específico, não invente um e não force um substituto de baixa qualidade — em vez disso, reduza o número de entradas \"artigo\"/\"site\" e prefira \"video\" ou \"livro\" que você tenha confiança de que são reais e relevantes, mantendo ao menos o mínimo de referências exigido.",
  `Sugira entre ${MIN_REFERENCIAS} e ${MAX_REFERENCIAS} recursos complementares reais e de alta qualidade, genuinamente relevantes ao tema da aula e suas facetas específicas.`,
  "Para cada referência, \"url\" deve ser o link exato, direto e real encontrado via web_search para aquele recurso específico — a página do PubMed/PMC, a página oficial da diretriz, a página de exibição do próprio vídeo, ou uma página real de loja vendendo o livro — nunca uma página de resultados de busca. Só inclua \"url\" quando a busca de fato retornou uma página funcional e diretamente relevante — nunca chute ou construa uma você mesmo. Se não achar um link real com confiança para um item, omita a \"url\" só daquele item em vez de inventar uma.",
  "Varie o \"type\" ao longo da lista em vez de repetir o mesmo tipo em toda entrada, e inclua ao menos um \"video\" sempre que o tema razoavelmente tiver bons vídeos educacionais disponíveis.",
  "A \"introduction\" é uma frase curta situando isso como material extra para aprofundar o entendimento da aula.",
  "Escreva em um tom claro, profissional e encorajador.",
  "Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

const INPUT_SCHEMA: LlmJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    introduction: {
      type: "string",
      description: "Frase curta situando o material como complemento da aula.",
    },
    references: {
      type: "array",
      description: `Entre ${MIN_REFERENCIAS} e ${MAX_REFERENCIAS} referências, tipos variados.`,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string", enum: ["artigo", "video", "livro", "site"] },
          description: { type: "string" },
          url: {
            type: "string",
            description: "URL real encontrada via busca; omitir se não tiver certeza.",
          },
        },
        required: ["title", "type", "description"],
      },
    },
  },
  required: ["title", "introduction", "references"],
};

/**
 * Gera o material complementar (leituras/vídeos com pesquisa web real).
 * Diferente de slides/simulado/resumo, não usa tool-use forçado: a Anthropic
 * não permite combinar `tool_choice` forçado com a tool `web_search`, então
 * a saída é JSON descrito no prompt + `parseLlmJson` (mesmo padrão do
 * `SupplementaryMaterialService` original).
 */
@Injectable()
export class MaterialComplementarIaService {
  private readonly logger = new Logger(MaterialComplementarIaService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(LLM_WEB_SEARCH_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly contexto: ContextoAulaService,
  ) {}

  get enabled(): boolean {
    return isLlmConfigured(this.config);
  }

  async gerar(ctx: ContextoAula, apresentacao?: Apresentacao | null): Promise<MaterialComplementar> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        "Geração por IA indisponível: configure GEMINI_API_KEY ou ANTHROPIC_API_KEY.",
      );
    }

    const partes = [this.contexto.descrever(ctx)];
    if (apresentacao) {
      partes.push("", "Temas cobertos na aula:", serializarSlides(apresentacao));
    }
    partes.push("", `Idioma de todo o conteúdo: ${ctx.idioma}.`);
    const userPrompt = partes.join("\n");

    let ultimoErro = "";
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const prompt = ultimoErro
        ? `${userPrompt}\n\nA tentativa anterior foi rejeitada por: ${ultimoErro}. Corrija exatamente esses pontos.`
        : userPrompt;

      const bruto = await this.llmProvider.generateJson({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: prompt,
        inputSchema: INPUT_SCHEMA,
        enableWebSearch: true,
        maxTokens: 4000,
        label: TOOL_NAME,
      });

      const parsed = materialComplementarSchema.safeParse(parseLlmJson(bruto));
      if (parsed.success) return parsed.data;

      ultimoErro = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "raiz"}: ${i.message}`)
        .join("; ");
      this.logger.warn(`Saída da IA reprovada (tentativa ${tentativa + 1}): ${ultimoErro}`);
    }

    throw new UnprocessableEntityException(
      `A IA não produziu um resultado válido (${ultimoErro}). Tente gerar novamente.`,
    );
  }
}
