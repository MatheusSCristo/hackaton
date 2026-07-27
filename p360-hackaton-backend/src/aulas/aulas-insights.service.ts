import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  isLlmConfigured,
  LLM_PROVIDER,
  LlmJsonSchema,
  LlmProvider,
} from "../llm/llm-provider.interface";
import { AulasService } from "./aulas.service";
import type { DicaIA, InsightsDto } from "./dto/aula-response.dto";

const TOOL_NAME = "registrar_dicas";

const DICAS_SCHEMA: LlmJsonSchema = {
  type: "object",
  properties: {
    dicas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título curto da dica." },
          texto: {
            type: "string",
            description: "1–2 frases acionáveis para o professor.",
          },
          prioridade: {
            type: "string",
            enum: ["alta", "media", "baixa"],
          },
        },
        required: ["titulo", "texto", "prioridade"],
      },
    },
  },
  required: ["dicas"],
};

const SYSTEM_PROMPT =
  "Você é um assistente pedagógico para professores de medicina. A partir do " +
  "histórico de aulas do professor e do desempenho da turma (média de acertos " +
  "e engajamento por aula), gere dicas curtas e acionáveis do que reforçar ou " +
  "ensinar a seguir. Priorize temas com menor desempenho. Seja específico e " +
  "clínico; não invente dados além dos fornecidos.";

@Injectable()
export class AulasInsightsService {
  private readonly logger = new Logger(AulasInsightsService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly aulas: AulasService,
  ) {}

  async generate(professorId: string): Promise<InsightsDto> {
    const aulas = await this.aulas.listByProfessor(professorId);
    if (aulas.length === 0) {
      return {
        ia: false,
        dicas: [
          {
            titulo: "Comece criando sua primeira aula",
            texto:
              "Ao criar aulas e acompanhar o desempenho da turma, aparecerão aqui dicas do que reforçar.",
            prioridade: "media",
          },
        ],
      };
    }

    const resumo = aulas
      .map((a) => {
        const foco = a.tema || a.casoTitulo || a.titulo;
        const acertos = a.metrica ? `${a.metrica.mediaAcertos}%` : "s/ dados";
        const eng = a.metrica
          ? `${a.metrica.alunosTotal ? Math.round((100 * a.metrica.alunosEngajados) / a.metrica.alunosTotal) : 0}%`
          : "s/ dados";
        return `- ${foco} (${a.publico || "público n/d"}): acertos ${acertos}, engajamento ${eng}`;
      })
      .join("\n");

    if (!isLlmConfigured(this.config)) {
      return { ia: false, dicas: this.heuristica(aulas) };
    }

    try {
      const parsed = (await this.llmProvider.generateStructured({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: `Aulas do professor e desempenho da turma:\n${resumo}\n\nGere 3 a 4 dicas.`,
        toolName: TOOL_NAME,
        toolDescription:
          "Registra 3 a 4 dicas pedagógicas do que o professor deve reforçar/ensinar a seguir.",
        inputSchema: DICAS_SCHEMA,
        maxTokens: 1024,
        label: TOOL_NAME,
      })) as { dicas?: DicaIA[] };

      const dicas = parsed.dicas;
      if (dicas && dicas.length > 0) {
        return { ia: true, dicas };
      }
      return { ia: false, dicas: this.heuristica(aulas) };
    } catch (error) {
      this.logger.error(`Falha ao gerar dicas (LLM): ${String(error)}`);
      return { ia: false, dicas: this.heuristica(aulas) };
    }
  }

  /** Dicas simples derivadas da aula com menor desempenho. */
  private heuristica(
    aulas: Awaited<ReturnType<AulasService["listByProfessor"]>>,
  ): DicaIA[] {
    const comMetrica = aulas.filter((a) => a.metrica);
    const pior = [...comMetrica].sort(
      (a, b) => (a.metrica!.mediaAcertos ?? 0) - (b.metrica!.mediaAcertos ?? 0),
    )[0];
    const dicas: DicaIA[] = [];
    if (pior) {
      const foco = pior.tema || pior.casoTitulo || pior.titulo;
      dicas.push({
        titulo: `Reforçar: ${foco}`,
        texto: `A turma teve ${pior.metrica!.mediaAcertos}% de acertos nessa aula — vale revisar os pontos-chave em sala.`,
        prioridade: "alta",
      });
    }
    dicas.push({
      titulo: "Use o briefing pré-aula",
      texto:
        "Liberar o início do caso antes da aula gera hipóteses da turma para discutir em sala.",
      prioridade: "media",
    });
    return dicas;
  }
}
