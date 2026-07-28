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
  email: string | null;
  tentativas: number;
  mediaAcertos: number;
}

/** Mesma ideia, mas identificado por e-mail — é o que a enquete coleta do respondente. */
export interface DesempenhoAlunoEnquete {
  email: string;
  nome: string | null;
  respostas: number;
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

export interface FaixaDistribuicao {
  faixa: string;
  minimo: number;
  quantidade: number;
}

export interface InsightMetrica {
  tipo: "critico" | "atencao" | "positivo" | "info";
  titulo: string;
  texto: string;
}

export interface MetricasDetalhadas {
  kpis: MetricasKpis;
  insights: InsightMetrica[];
  distribuicaoAcertos: FaixaDistribuicao[];
  questoesMaisDificeis: QuestaoDificil[];
  desempenhoPorAluno: DesempenhoAluno[];
  desempenhoPorAlunoEnquete: DesempenhoAlunoEnquete[];
  porAula: DesempenhoPorAula[];
}

export async function getMetricasDetalhadas(): Promise<MetricasDetalhadas> {
  const { data } = await hackatonApi.get<MetricasDetalhadas>("/api/metricas");
  return data;
}
