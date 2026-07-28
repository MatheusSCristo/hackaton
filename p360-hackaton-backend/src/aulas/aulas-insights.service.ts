import { Injectable } from "@nestjs/common";

import { MetricasService } from "../metricas/metricas.service";
import type { InsightMetrica } from "../metricas/metricas.service";
import type { DicaIA, InsightsDto } from "./dto/aula-response.dto";

const PRIORIDADE_POR_TIPO: Record<InsightMetrica["tipo"], DicaIA["prioridade"]> = {
  critico: "alta",
  atencao: "media",
  info: "baixa",
  positivo: "baixa",
};

/** Mais grave primeiro — se sobrar mais que `MAX_DICAS`, os críticos ganham. */
const ORDEM_TIPO: Record<InsightMetrica["tipo"], number> = {
  critico: 0,
  atencao: 1,
  info: 2,
  positivo: 3,
};

const MAX_DICAS = 3;

/**
 * "Insights rápidos" do Overview — computados na hora a partir de
 * simulado/enquete (mesma fonte da tela de Métricas), **sem chamar LLM**:
 * é aritmética sobre dados que já temos, não vale gastar token nem esperar
 * uma resposta de rede pra isso. Ver `MetricasService.gerarInsights` (o
 * mesmo cálculo alimenta a tela de Métricas).
 */
@Injectable()
export class AulasInsightsService {
  constructor(private readonly metricas: MetricasService) {}

  async generate(professorId: string): Promise<InsightsDto> {
    const { insights } = await this.metricas.detalhado(professorId);

    if (insights.length === 0) {
      return {
        ia: false,
        dicas: [
          {
            titulo: "Comece criando sua primeira aula",
            texto:
              "Ao criar aulas e coletar respostas de simulado ou enquete, aqui aparecerão insights reais sobre o desempenho da turma.",
            prioridade: "media",
          },
        ],
      };
    }

    const ordenados = [...insights].sort(
      (a, b) => ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo],
    );

    const dicas: DicaIA[] = ordenados.slice(0, MAX_DICAS).map((insight) => ({
      titulo: insight.titulo,
      texto: insight.texto,
      prioridade: PRIORIDADE_POR_TIPO[insight.tipo],
    }));

    return { ia: false, dicas };
  }
}
