import { hackatonApi } from "@/api/api";

import type { Bloco } from "./blocos";

export interface TurmaLegacy {
  id: number;
  nome: string;
  codigoAcesso: string | null;
}

export interface EtapaAgregada {
  chave: string;
  label: string;
  alunos: number;
  porcentagem: number;
}

export interface AgregadoCaso {
  alunosTotal: number;
  alunosEngajados: number;
  concluidos: number;
  taxaConclusao: number;
  engajamento: number;
  etapas: EtapaAgregada[];
  tempos: { evento: string; segundos: number }[];
}

export interface PontoFraco {
  titulo: string;
  descricao: string;
  etapa: string;
  severidade: "alta" | "media" | "baixa";
  evidencia: string;
  sugestaoReforco: string;
}

export interface DiagnosticoTurma {
  pontosFracos: PontoFraco[];
  resumo: string;
  ia: boolean;
}

export interface ProgressoCaso {
  concluidos: number;
  iniciaram: number;
  alunosTotal: number;
}

const base = (aulaId: string, blocoId: string) =>
  `/api/aulas/${aulaId}/blocos/${blocoId}/caso`;

export async function getTurmas(
  aulaId: string,
  blocoId: string,
): Promise<TurmaLegacy[]> {
  const { data } = await hackatonApi.get<TurmaLegacy[]>(
    `${base(aulaId, blocoId)}/turmas`,
  );
  return data;
}

/**
 * Mesma lista de turmas, mas usável ANTES de a aula existir — a etapa de
 * criação escolhe a turma do caso já ali, não mais depois no cockpit.
 */
export async function getTurmasCriacao(): Promise<TurmaLegacy[]> {
  const { data } = await hackatonApi.get<TurmaLegacy[]>("/api/caso/turmas");
  return data;
}

export async function prepararCaso(
  aulaId: string,
  blocoId: string,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/preparar`,
    {},
  );
  return data;
}

export async function liberarCaso(
  aulaId: string,
  blocoId: string,
  sessaoId: string,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/liberar/${sessaoId}`,
    {},
  );
  return data;
}

export async function encerrarCaso(
  aulaId: string,
  blocoId: string,
  sessaoId: string,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/encerrar/${sessaoId}`,
    {},
  );
  return data;
}

export async function coletarCaso(
  aulaId: string,
  blocoId: string,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/coletar`,
    {},
  );
  return data;
}

export async function getProgressoCaso(
  aulaId: string,
  blocoId: string,
): Promise<ProgressoCaso> {
  const { data } = await hackatonApi.get<ProgressoCaso>(
    `${base(aulaId, blocoId)}/progresso`,
  );
  return data;
}

/**
 * Aluno: autoriza e recebe a URL do player legado, pronta para abrir.
 *
 * Precisa ser XHR (e não navegação) porque é o interceptor do axios que anexa o
 * `X-Access-Token` — `window.open` não envia headers.
 */
export async function autorizarCaso(
  sessaoId: string,
  blocoId: string,
): Promise<{ url: string }> {
  const { data } = await hackatonApi.post<{ url: string }>(
    `/api/sessoes/${sessaoId}/blocos/${blocoId}/caso/autorizar`,
    {},
  );
  return data;
}
