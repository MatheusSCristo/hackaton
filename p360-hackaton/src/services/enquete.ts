import { hackatonApi } from "@/api/api";

import type { Bloco } from "./blocos";

/**
 * Enquete de um bloco em três passos separados: **gerar** (IA, rascunho) →
 * **publicar** (cria no poll360) → **iniciar** (abre a sessão com PIN).
 * A separação é intencional: o professor revisa antes de os alunos verem.
 */

export interface GerarEnquetePayload {
  nPerguntas?: number;
  idioma?: string;
}

export async function gerarEnquete(
  aulaId: string,
  blocoId: string,
  payload: GerarEnquetePayload = {},
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `/api/aulas/${aulaId}/blocos/${blocoId}/enquete/gerar`,
    payload,
  );
  return data;
}

export async function publicarEnquete(
  aulaId: string,
  blocoId: string,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `/api/aulas/${aulaId}/blocos/${blocoId}/enquete/publicar`,
    {},
  );
  return data;
}

/**
 * Sobe uma questão ao vivo. `indice` é 0-based; o PIN da turma não muda entre
 * questões (o poll360 reaproveita o `accessPin`), então avançar não obriga
 * ninguém a reentrar na sala.
 */
export async function iniciarEnquete(
  aulaId: string,
  blocoId: string,
  indice = 0,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `/api/aulas/${aulaId}/blocos/${blocoId}/enquete/iniciar`,
    { indice },
  );
  return data;
}

/**
 * Só registra em qual questão a sala está agora (bookkeeping) — quem troca a
 * questão de verdade pra turma é a tela de apresentação, direto no WebSocket
 * do poll360 (`useEnqueteLive().reiniciar`). Chamar `iniciarEnquete` de novo
 * pra trocar de questão reabre a sessão no poll360 sem avisar ninguém.
 */
export async function trocarQuestaoAtual(
  aulaId: string,
  blocoId: string,
  indice: number,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `/api/aulas/${aulaId}/blocos/${blocoId}/enquete/questao-atual`,
    { indice },
  );
  return data;
}

export interface OpcaoResultadoEnquete {
  texto: string;
  correta: boolean;
  votos: number;
}

/**
 * Registra o resultado agregado de uma questão (chamado quando o professor
 * encerra a votação) — vira dado pra tela de métricas, já que o poll360 não
 * expõe voto individual pra consulta depois.
 */
export async function registrarResultadoEnquete(
  aulaId: string,
  blocoId: string,
  payload: {
    questaoIndex: number;
    enunciado: string;
    opcoes: OpcaoResultadoEnquete[];
  },
): Promise<void> {
  await hackatonApi.post(
    `/api/aulas/${aulaId}/blocos/${blocoId}/enquete/resultado`,
    payload,
  );
}
