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
import {
  MAX_REFERENCIAS,
  materialComplementarSchema,
  MIN_REFERENCIAS,
  referenciaSchema,
} from "./schemas";
import type { Apresentacao, MaterialComplementar, Referencia } from "./schemas";
import { serializarSlides } from "./simulado-ia.service";
import { z } from "zod";

const TOOL_NAME = "registrar_material_complementar";

const REGRA_CREDIBILIDADE =
  "REGRA DE CREDIBILIDADE (obrigatória, prioridade máxima): toda referência do tipo \"artigo\" deve ser um artigo real e indexado no PubMed (busque site:pubmed.ncbi.nlm.nih.gov ou ncbi.nlm.nih.gov/pmc) — a \"url\" deve apontar direto para essa página do PubMed/PMC. Toda referência \"site\" deve ser uma diretriz clínica oficial ou fonte institucional (sociedade médica, autoridade de saúde governamental, organização internacional de saúde como OMS/Ministério da Saúde) — nunca um blog genérico, fórum ou site de resumo não oficial.";

const REGRA_URL =
  "Para cada referência, \"url\" deve ser o link exato, direto e real encontrado via web_search para aquele recurso específico — nunca uma página de resultados de busca. Só inclua \"url\" quando a busca de fato retornou uma página funcional e diretamente relevante — nunca chute ou construa uma você mesmo. Se não achar um link real com confiança para um item, omita a \"url\" só daquele item em vez de inventar uma.";

/**
 * Duas rodadas de busca web **em paralelo** em vez de uma só pedindo tudo de
 * uma vez: cada chamada busca menos itens (logo, menos rodadas internas de
 * `web_search`, que é o que realmente consome tempo), e como rodam ao mesmo
 * tempo o tempo total fica perto do MAIOR dos dois, não da soma. A rigorosa
 * (artigo/site) sozinha já cobre o mínimo exigido — a de mídia (vídeo/livro)
 * é só um bônus best-effort, então uma falha nela não derruba o resultado.
 */
const MIN_RIGOROSAS = MIN_REFERENCIAS;
const MAX_RIGOROSAS = Math.min(MIN_REFERENCIAS + 2, MAX_REFERENCIAS);
const MAX_MIDIA = MAX_REFERENCIAS - MIN_RIGOROSAS;

const SYSTEM_PROMPT_RIGOROSO = [
  "Você é um bibliotecário de pesquisa médica que cura referências de altíssima credibilidade pra acompanhar uma aula.",
  "Você tem a ferramenta `web_search` disponível. Use-a pra achar as referências reais antes de responder.",
  REGRA_CREDIBILIDADE,
  "Se não encontrar um artigo genuíno do PubMed ou uma diretriz oficial verdadeiramente relevante pra este tema específico, não invente um — prefira devolver menos itens a forçar um substituto de baixa qualidade, mas sempre tente entregar pelo menos o mínimo pedido.",
  `Devolva entre ${MIN_RIGOROSAS} e ${MAX_RIGOROSAS} referências, só dos tipos "artigo" e "site" (nunca "video" ou "livro" aqui — isso é responsabilidade de outra busca).`,
  REGRA_URL,
  "A \"introduction\" é uma frase curta situando isso como material extra pra aprofundar o entendimento da aula.",
  "Escreva em um tom claro, profissional e encorajador. Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

const SYSTEM_PROMPT_MIDIA = [
  "Você cura recursos educacionais em vídeo e livros pra acompanhar uma aula.",
  "Você tem a ferramenta `web_search` disponível. Use-a pra achar os recursos reais antes de responder — a página de exibição do próprio vídeo, ou uma página real de loja vendendo o livro.",
  `Devolva até ${MAX_MIDIA} referências, só dos tipos "video" e "livro". Se não encontrar nenhum recurso de real qualidade e relevância pro tema, devolva uma lista vazia — não force um resultado ruim.`,
  REGRA_URL,
  "Escreva TODO o conteúdo no idioma solicitado.",
].join(" ");

function schemaReferencias(min: number, max: number): LlmJsonSchema["properties"] {
  return {
    references: {
      type: "array",
      description: `Entre ${min} e ${max} referências.`,
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
  };
}

const INPUT_SCHEMA_RIGOROSO: LlmJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    introduction: {
      type: "string",
      description: "Frase curta situando o material como complemento da aula.",
    },
    ...schemaReferencias(MIN_RIGOROSAS, MAX_RIGOROSAS),
  },
  required: ["title", "introduction", "references"],
};

const INPUT_SCHEMA_MIDIA: LlmJsonSchema = {
  type: "object",
  properties: schemaReferencias(0, MAX_MIDIA),
  required: ["references"],
};

const parteRigorosaSchema = z.object({
  title: z.string().min(1).max(100),
  introduction: z.string().min(1).max(500),
  references: z.array(referenciaSchema).min(MIN_RIGOROSAS).max(MAX_RIGOROSAS),
});

const parteMidiaSchema = z.object({
  references: z.array(referenciaSchema).max(MAX_MIDIA),
});

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

    // As duas buscas rodam em paralelo — o tempo total fica perto da mais
    // lenta das duas, não da soma. `allSettled` porque a de mídia é opcional:
    // uma falha nela não pode derrubar o resultado todo.
    const [rigorosaResult, midiaResult] = await Promise.allSettled([
      this.gerarParte(
        SYSTEM_PROMPT_RIGOROSO,
        userPrompt,
        INPUT_SCHEMA_RIGOROSO,
        parteRigorosaSchema,
        `${TOOL_NAME}_rigoroso`,
      ),
      this.gerarParte(
        SYSTEM_PROMPT_MIDIA,
        userPrompt,
        INPUT_SCHEMA_MIDIA,
        parteMidiaSchema,
        `${TOOL_NAME}_midia`,
      ),
    ]);

    if (rigorosaResult.status === "rejected") {
      this.logger.warn(`Busca rigorosa falhou: ${String(rigorosaResult.reason)}`);
      throw new UnprocessableEntityException(
        "A IA não produziu um resultado válido para o material complementar. Tente gerar novamente.",
      );
    }

    const referenciasMidia: Referencia[] =
      midiaResult.status === "fulfilled" ? midiaResult.value.references : [];
    if (midiaResult.status === "rejected") {
      this.logger.warn(
        `Busca de mídia (vídeo/livro) falhou, seguindo só com as referências rigorosas: ${String(midiaResult.reason)}`,
      );
    }

    const combinado = {
      title: rigorosaResult.value.title,
      introduction: rigorosaResult.value.introduction,
      references: [...rigorosaResult.value.references, ...referenciasMidia].slice(
        0,
        MAX_REFERENCIAS,
      ),
    };

    const parsed = materialComplementarSchema.safeParse(combinado);
    if (parsed.success) return parsed.data;

    // Só pode ter dado errado na combinação (ex.: união abaixo do mínimo,
    // improvável já que a rigorosa sozinha garante isso) — não é caso de
    // pesquisar de novo, é só reportar.
    const erro = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "raiz"}: ${i.message}`)
      .join("; ");
    throw new UnprocessableEntityException(
      `A IA não produziu um resultado válido (${erro}). Tente gerar novamente.`,
    );
  }

  /**
   * Uma parte (rigorosa ou mídia) com busca web real. Se a saída não bater
   * com o schema, refaz só a formatação (sem pesquisar de novo — a parte
   * cara já foi feita) em vez de tentar tudo de novo do zero.
   */
  private async gerarParte<T>(
    systemPrompt: string,
    userPrompt: string,
    inputSchema: LlmJsonSchema,
    schema: z.ZodType<T>,
    label: string,
  ): Promise<T> {
    const bruto = await this.llmProvider.generateJson({
      systemPrompt,
      userPrompt,
      inputSchema,
      enableWebSearch: true,
      maxTokens: 2500,
      label,
    });

    const parsed = schema.safeParse(parseLlmJson(bruto));
    if (parsed.success) return parsed.data;

    const erro = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "raiz"}: ${i.message}`)
      .join("; ");
    this.logger.warn(`Saída da IA reprovada (${label}): ${erro}`);

    const promptCorrecao = [
      "Você gerou o JSON abaixo, mas ele foi rejeitado por um validador.",
      `Problema(s): ${erro}.`,
      "Corrija SOMENTE a estrutura/formato apontado no problema, mantendo exatamente o mesmo conteúdo/referências já encontrados (não invente nada novo, não pesquise de novo).",
      "JSON gerado anteriormente:",
      bruto,
    ].join("\n\n");

    const corrigido = await this.llmProvider.generateJson({
      systemPrompt,
      userPrompt: promptCorrecao,
      inputSchema,
      enableWebSearch: false,
      maxTokens: 2500,
      label: `${label}_correcao`,
    });

    return schema.parse(parseLlmJson(corrigido));
  }
}
