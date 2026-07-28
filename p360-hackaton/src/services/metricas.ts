import { hackatonApi } from "@/api/api";

export interface MetricasKpis {
  totalAulas: number;
  alunosImpactados: number;
  mediaAcertos: number;
  engajamento: number;
}

export interface QuestaoDificil {
  aulaId: string;
  aulaTitulo: string;
  blocoId: string;
  tipo: "simulado" | "enquete";
  enunciado: string;
  respostas: number;
  pctAcerto: number;
}

export interface DesempenhoAluno {
  usuarioId: string;
  nome: string | null;
  tentativas: number;
  mediaAcertos: number;
}

export interface DesempenhoPorAula {
  aulaId: string;
  aulaTitulo: string;
  tentativasSimulado: number;
  mediaSimulado: number | null;
  questoesEnquete: number;
  mediaEnquete: number | null;
}

export interface MetricasDetalhadas {
  kpis: MetricasKpis;
  questoesMaisDificeis: QuestaoDificil[];
  desempenhoPorAluno: DesempenhoAluno[];
  porAula: DesempenhoPorAula[];
}

export async function getMetricasDetalhadas(): Promise<MetricasDetalhadas> {
  const { data } = await hackatonApi.get<MetricasDetalhadas>("/api/metricas");
  return data;
}
