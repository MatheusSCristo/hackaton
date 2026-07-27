import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_N_PERGUNTAS = 5;
const MAX_N_PERGUNTAS = 10;
const MIN_OPCOES = 3;
const MAX_OPCOES = 5;

export interface OpcaoEnquete {
  texto: string;
  correta: boolean;
  justificativa: string;
  pontos: number;
}

export interface PerguntaEnquete {
  enunciado: string;
  opcoes: OpcaoEnquete[];
}

export interface GerarEnqueteInput {
  /** Contexto do caso clínico, quando a aula parte de um caso. */
  casoTitulo?: string | null;
  casoDescricao?: string | null;
  area?: string | null;
  tema?: string | null;
  /** Objetivos/público da aula, para calibrar profundidade. */
  objetivos?: string | null;
  publico?: string | null;
  /**
   * Pontos fracos da turma (do diagnóstico de um bloco de caso anterior).
   * Quando presentes, a enquete foca neles em vez de cobrir o tema em geral.
   */
  fraquezas?: string[];
  nPerguntas?: number;
  /** Idioma da sessão (o host passa `?lang=`). O conteúdo segue este idioma. */
  idioma?: string;
}

const TOOL_NAME = "gerar_enquete";

const SYSTEM_PROMPT =
  "Você elabora questões de múltipla escolha para uma enquete ao vivo em aula de medicina. " +
  "Cada questão deve ter um enunciado claro e objetivo, e exatamente UMA alternativa correta. " +
  "As alternativas incorretas devem ser plausíveis (erros que estudantes realmente cometem), " +
  "nunca absurdas ou obviamente descartáveis. " +
  "Inclua uma justificativa curta para cada alternativa, explicando por que está certa ou errada. " +
  "Não repita o texto de alternativas dentro da mesma questão. " +
  "Escreva TODO o conteúdo no idioma solicitado.";

const GERAR_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Registra as questões da enquete gerada para a aula.",
  input_schema: {
    type: "object",
    properties: {
      perguntas: {
        type: "array",
        description: "Questões da enquete, na ordem de aplicação.",
        items: {
          type: "object",
          properties: {
            enunciado: {
              type: "string",
              description: "Pergunta apresentada aos alunos.",
            },
            opcoes: {
              type: "array",
              description: `Alternativas (${MIN_OPCOES} a ${MAX_OPCOES}); exatamente uma com correta=true.`,
              items: {
                type: "object",
                properties: {
                  texto: { type: "string" },
                  correta: { type: "boolean" },
                  justificativa: {
                    type: "string",
                    description:
                      "Por que esta alternativa está correta ou incorreta.",
                  },
                  pontos: {
                    type: "integer",
                    description: "Pontos da alternativa (0 para incorretas).",
                  },
                },
                required: ["texto", "correta", "justificativa", "pontos"],
              },
            },
          },
          required: ["enunciado", "opcoes"],
        },
      },
    },
    required: ["perguntas"],
  },
};

/**
 * Gera o conteúdo da enquete com Claude (saída estruturada por tool use
 * forçado). O resultado é sempre **rascunho**: o professor revisa antes de
 * publicar no poll360 — nunca publicamos automaticamente.
 */
@Injectable()
export class EnqueteIaService {
  private readonly logger = new Logger(EnqueteIaService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("ANTHROPIC_API_KEY");
    this.model = config.get<string>("ANTHROPIC_MODEL") || DEFAULT_MODEL;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        "ANTHROPIC_API_KEY ausente — geração de enquete indisponível (503).",
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async gerar(input: GerarEnqueteInput): Promise<PerguntaEnquete[]> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Geração por IA indisponível: configure ANTHROPIC_API_KEY.",
      );
    }

    const n = clampPerguntas(input.nPerguntas);
    const idioma = input.idioma?.trim() || "pt-BR";

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [GERAR_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: buildPrompt(input, n, idioma) }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME,
    );
    const parsed = (toolUse?.input ?? {}) as { perguntas?: unknown };

    return validarPerguntas(parsed.perguntas, n);
  }
}

function clampPerguntas(n: number | undefined): number {
  if (!Number.isFinite(n)) return DEFAULT_N_PERGUNTAS;
  return Math.min(MAX_N_PERGUNTAS, Math.max(1, Math.trunc(n as number)));
}

function buildPrompt(
  input: GerarEnqueteInput,
  n: number,
  idioma: string,
): string {
  const linhas: string[] = [];

  if (input.casoTitulo) {
    linhas.push(`Caso clínico da aula: ${input.casoTitulo}`);
    if (input.casoDescricao) {
      linhas.push(`Resumo do caso: ${input.casoDescricao.slice(0, 600)}`);
    }
  }
  if (input.area) linhas.push(`Especialidade: ${input.area}`);
  if (input.tema) linhas.push(`Tema/diagnóstico: ${input.tema}`);
  if (input.publico) linhas.push(`Público-alvo: ${input.publico}`);
  if (input.objetivos) {
    linhas.push(`Objetivos de aprendizagem: ${input.objetivos}`);
  }

  const fraquezas = (input.fraquezas ?? [])
    .map((f) => f.trim())
    .filter(Boolean);
  if (fraquezas.length > 0) {
    linhas.push(
      "",
      "A turma demonstrou dificuldade nos pontos abaixo. Concentre as questões " +
        "exatamente nesses pontos, para verificar se foram superados:",
      ...fraquezas.map((f) => `- ${f}`),
    );
  }

  linhas.push(
    "",
    `Gere ${n} ${n === 1 ? "questão" : "questões"} de múltipla escolha.`,
    `Idioma de todo o conteúdo: ${idioma}.`,
  );

  return linhas.join("\n");
}

/**
 * Valida a saída do modelo antes de aceitar. A UI depende dessas invariantes
 * (uma correta, alternativas distintas), e o poll360 receberia lixo sem isso.
 */
export function validarPerguntas(
  raw: unknown,
  esperado: number,
): PerguntaEnquete[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new UnprocessableEntityException(
      "A IA não retornou questões válidas. Tente gerar novamente.",
    );
  }

  const perguntas: PerguntaEnquete[] = [];

  for (const item of raw.slice(0, esperado)) {
    if (typeof item !== "object" || item === null) continue;
    const { enunciado, opcoes } = item as {
      enunciado?: unknown;
      opcoes?: unknown;
    };

    const texto = typeof enunciado === "string" ? enunciado.trim() : "";
    if (!texto || !Array.isArray(opcoes)) continue;

    const normalizadas: OpcaoEnquete[] = [];
    const vistos = new Set<string>();

    for (const opcao of opcoes.slice(0, MAX_OPCOES)) {
      if (typeof opcao !== "object" || opcao === null) continue;
      const o = opcao as Record<string, unknown>;
      const textoOpcao = typeof o.texto === "string" ? o.texto.trim() : "";
      if (!textoOpcao) continue;

      const chave = textoOpcao.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      const pontos = Number(o.pontos);
      normalizadas.push({
        texto: textoOpcao,
        correta: o.correta === true,
        justificativa:
          typeof o.justificativa === "string" ? o.justificativa.trim() : "",
        pontos: Number.isFinite(pontos) && pontos > 0 ? Math.trunc(pontos) : 0,
      });
    }

    if (normalizadas.length < MIN_OPCOES) continue;

    // Exatamente uma correta: se vier mais de uma, mantém a primeira; se não
    // vier nenhuma, a questão é descartada (não há gabarito para ensinar).
    const corretas = normalizadas.filter((o) => o.correta);
    if (corretas.length === 0) continue;
    if (corretas.length > 1) {
      let primeira = true;
      for (const opcao of normalizadas) {
        if (!opcao.correta) continue;
        if (primeira) {
          primeira = false;
          continue;
        }
        opcao.correta = false;
        opcao.pontos = 0;
      }
    }

    // Garante ao menos 1 ponto na correta, para o ranking do poll360.
    const correta = normalizadas.find((o) => o.correta);
    if (correta && correta.pontos === 0) correta.pontos = 1;
    for (const opcao of normalizadas) {
      if (!opcao.correta) opcao.pontos = 0;
    }

    perguntas.push({ enunciado: texto, opcoes: normalizadas });
  }

  if (perguntas.length === 0) {
    throw new UnprocessableEntityException(
      "As questões geradas não passaram na validação (alternativa correta ausente ou opções insuficientes). Tente novamente.",
    );
  }

  return perguntas;
}
