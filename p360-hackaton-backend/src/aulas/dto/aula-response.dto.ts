import type { BlocoDto } from "./bloco.dto";

export interface AulaMetricaDto {
  alunosTotal: number;
  alunosEngajados: number;
  mediaAcertos: number;
  taxaConclusao: number;
  /** % de engajamento derivado (engajados / total). */
  engajamento: number;
}

export interface AulaDto {
  id: string;
  titulo: string;
  modo: string;
  /** Id do caso no acervo legado (quando a aula parte de um caso). */
  casoLegacyId: number | null;
  casoTitulo: string | null;
  tema: string | null;
  publico: string | null;
  duracao: string | null;
  formato: string | null;
  createdAt: string;
  /** Materiais do modelo antigo (compatibilidade). */
  materiais: string[];
  /** Sequência de blocos da sessão, ordenada. */
  blocos: BlocoDto[];
  metrica: AulaMetricaDto | null;
}

export interface OverviewKpis {
  totalAulas: number;
  alunosImpactados: number;
  /** Média de acertos entre as aulas (0–100). */
  mediaAcertos: number;
  /** Engajamento médio (0–100). */
  engajamento: number;
}

export interface OverviewDto {
  kpis: OverviewKpis;
  aulas: AulaDto[];
}

export interface DicaIA {
  titulo: string;
  texto: string;
  prioridade: "alta" | "media" | "baixa";
}

export interface InsightsDto {
  dicas: DicaIA[];
  /** false = geradas por heurística (sem chave Anthropic). */
  ia: boolean;
}
