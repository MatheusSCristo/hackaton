import { hackatonApi } from "@/api/api";

/** Tipos de bloco de uma sessão de aula (espelha o backend). */
export const TIPOS_BLOCO = [
  "slides",
  "caso",
  "enquete",
  "simulado",
  "resumo",
  "reforco",
] as const;
export type TipoBloco = (typeof TIPOS_BLOCO)[number];

/** Blocos já implementados; os demais aparecem desabilitados. */
export const TIPOS_BLOCO_HABILITADOS: readonly TipoBloco[] = [
  "slides",
  "enquete",
  "caso",
  "simulado",
  "resumo",
];

export type FocoEnquete = "geral" | "fraquezas";

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

/** `output` do bloco — varia por tipo; campos são opcionais por natureza. */
export interface BlocoOutput {
  /** Pós-aula: disponibilizado para a turma (ISO) ou null. */
  publicadoEm?: string | null;
  /** Simulado: gabarito comentado liberado aos alunos. */
  gabaritoLiberado?: boolean;
  perguntas?: PerguntaEnquete[];
  focoAplicado?: FocoEnquete;
  geradoEm?: string;
  poll360PackageId?: string;
  poll360PollIds?: string[];
  accessPin?: string;
  joinUrl?: string;
  iniciadoEm?: string;
  [key: string]: unknown;
}

export interface BlocoConfig {
  foco?: FocoEnquete;
  nPerguntas?: number;
  [key: string]: unknown;
}

export interface Bloco {
  id: string;
  ordem: number;
  tipo: string;
  origem: string;
  /** sessao (ao vivo) | pos_aula (fixação em casa) — derivado do tipo. */
  momento?: string;
  config: BlocoConfig;
  output: BlocoOutput | null;
}

export interface AulaTemplate {
  id: string;
  nome: string;
  descricao: string;
  blocos: { tipo: TipoBloco; config?: BlocoConfig }[];
}

export async function getTemplates(): Promise<AulaTemplate[]> {
  const { data } = await hackatonApi.get<AulaTemplate[]>("/api/aula-templates");
  return data;
}

export async function getBlocos(aulaId: string): Promise<Bloco[]> {
  const { data } = await hackatonApi.get<Bloco[]>(
    `/api/aulas/${aulaId}/blocos`,
  );
  return data;
}

export async function addBloco(
  aulaId: string,
  payload: { tipo: TipoBloco; config?: BlocoConfig },
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `/api/aulas/${aulaId}/blocos`,
    payload,
  );
  return data;
}

export async function updateBloco(
  aulaId: string,
  blocoId: string,
  payload: { config?: BlocoConfig; ordem?: number },
): Promise<Bloco> {
  const { data } = await hackatonApi.patch<Bloco>(
    `/api/aulas/${aulaId}/blocos/${blocoId}`,
    payload,
  );
  return data;
}

export async function removeBloco(
  aulaId: string,
  blocoId: string,
): Promise<void> {
  await hackatonApi.delete(`/api/aulas/${aulaId}/blocos/${blocoId}`);
}

/** Envia a sequência completa de IDs na nova ordem. */
export async function reorderBlocos(
  aulaId: string,
  ordem: string[],
): Promise<Bloco[]> {
  const { data } = await hackatonApi.put<Bloco[]>(
    `/api/aulas/${aulaId}/blocos/reorder`,
    { ordem },
  );
  return data;
}

export async function applyTemplate(
  aulaId: string,
  templateId: string,
): Promise<Bloco[]> {
  const { data } = await hackatonApi.post<Bloco[]>(
    `/api/aulas/${aulaId}/apply-template`,
    { templateId },
  );
  return data;
}
