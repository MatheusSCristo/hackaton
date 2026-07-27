import { hackatonApi } from "@/api/api";

import type { Bloco, BlocoConfig, TipoBloco } from "./blocos";

export interface AulaMetrica {
  alunosTotal: number;
  alunosEngajados: number;
  mediaAcertos: number;
  taxaConclusao: number;
  engajamento: number;
}

export interface Aula {
  id: string;
  titulo: string;
  modo: string;
  casoTitulo: string | null;
  tema: string | null;
  publico: string | null;
  duracao: string | null;
  formato: string | null;
  createdAt: string;
  /** Materiais do modelo antigo (compatibilidade). Pode faltar em respostas antigas. */
  materiais?: string[];
  /** Sequência de blocos da sessão, ordenada. Pode faltar em respostas antigas. */
  blocos?: Bloco[];
  metrica: AulaMetrica | null;
}

export interface OverviewKpis {
  totalAulas: number;
  alunosImpactados: number;
  mediaAcertos: number;
  engajamento: number;
}

export interface Overview {
  kpis: OverviewKpis;
  aulas: Aula[];
}

export interface DicaIA {
  titulo: string;
  texto: string;
  prioridade: "alta" | "media" | "baixa";
}

export interface Insights {
  dicas: DicaIA[];
  ia: boolean;
}

export interface CriarAulaPayload {
  modo: "caso" | "tema";
  casoLegacyId?: number;
  casoTitulo?: string;
  tema?: string;
  publico?: string;
  duracao?: string;
  formato?: string;
  objetivos?: string;
  materiais?: string[];
  blocos?: { tipo: TipoBloco; config?: BlocoConfig }[];
}

export async function getOverview(): Promise<Overview> {
  const { data } = await hackatonApi.get<Overview>("/api/aulas/overview");
  return data;
}

export async function getInsights(): Promise<Insights> {
  const { data } = await hackatonApi.get<Insights>("/api/aulas/insights");
  return data;
}

export async function getAula(aulaId: string): Promise<Aula> {
  const { data } = await hackatonApi.get<Aula>(`/api/aulas/${aulaId}`);
  return data;
}

export async function criarAula(payload: CriarAulaPayload): Promise<Aula> {
  const { data } = await hackatonApi.post<Aula>("/api/aulas", payload);
  return data;
}
