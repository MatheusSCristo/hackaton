import { hackatonApi } from "@/api/api";

import type { Bloco } from "./blocos";

/** Snapshot completo da sessão — a fonte da verdade vem do backend. */
export interface EstadoSessao {
  sessaoId: string;
  codigo: string;
  status: "aguardando" | "ativa" | "encerrada" | string;
  aulaTitulo: string;
  blocoAtual: Bloco | null;
  estadoAtual: "liberado" | "encerrado" | null;
  /** Slide que o professor está mostrando — espelhado pra turma quando "ativa". */
  slideAtual: number;
  blocos: Bloco[];
  participantes: number;
}

export interface EntrarSessaoResposta {
  participanteId: string;
  estado: EstadoSessao;
}

export async function criarSessao(aulaId: string): Promise<EstadoSessao> {
  const { data } = await hackatonApi.post<EstadoSessao>(
    `/api/aulas/${aulaId}/sessoes`,
    {},
  );
  return data;
}

export async function getSessaoAtual(
  aulaId: string,
): Promise<EstadoSessao | null> {
  const { data } = await hackatonApi.get<EstadoSessao | null>(
    `/api/aulas/${aulaId}/sessoes/atual`,
  );
  return data;
}

/** Rota pública: a sala do aluno consulta antes de qualquer login. */
export async function getEstadoPorCodigo(
  codigo: string,
): Promise<EstadoSessao> {
  const { data } = await hackatonApi.get<EstadoSessao>(
    `/api/sessoes/${codigo}/estado`,
  );
  return data;
}

export async function entrarSessao(
  codigo: string,
  payload: { anonId?: string; nome?: string },
): Promise<EntrarSessaoResposta> {
  const { data } = await hackatonApi.post<EntrarSessaoResposta>(
    `/api/sessoes/${codigo}/entrar`,
    payload,
  );
  return data;
}

export async function liberarBloco(
  sessaoId: string,
  blocoId: string,
): Promise<EstadoSessao> {
  const { data } = await hackatonApi.post<EstadoSessao>(
    `/api/sessoes/${sessaoId}/blocos/${blocoId}/liberar`,
    {},
  );
  return data;
}

export async function encerrarBloco(
  sessaoId: string,
  blocoId: string,
): Promise<EstadoSessao> {
  const { data } = await hackatonApi.post<EstadoSessao>(
    `/api/sessoes/${sessaoId}/blocos/${blocoId}/encerrar`,
    {},
  );
  return data;
}

export async function encerrarSessao(sessaoId: string): Promise<EstadoSessao> {
  const { data } = await hackatonApi.post<EstadoSessao>(
    `/api/sessoes/${sessaoId}/encerrar`,
    {},
  );
  return data;
}

/** Confirma o início oficial — só depois disso a turma entra no modo ao vivo. */
export async function confirmarInicioSessao(
  sessaoId: string,
): Promise<EstadoSessao> {
  const { data } = await hackatonApi.post<EstadoSessao>(
    `/api/sessoes/${sessaoId}/confirmar`,
    {},
  );
  return data;
}

/** Espelha o slide atual da apresentação para a turma conectada. */
export async function atualizarSlideSessao(
  sessaoId: string,
  slideAtual: number,
): Promise<EstadoSessao> {
  const { data } = await hackatonApi.post<EstadoSessao>(
    `/api/sessoes/${sessaoId}/slide`,
    { slideAtual },
  );
  return data;
}
