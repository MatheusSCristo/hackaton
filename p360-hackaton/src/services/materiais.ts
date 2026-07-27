import { hackatonApi } from "@/api/api";
import Environment from "@/config/env";

import type { Bloco } from "./blocos";

/** Sugestão de imagem do slide, já resolvida pelo backend (URL real ou data URI). */
export interface SlideVisual {
  keyword: string;
  imageUrl?: string;
}

/** Estrutura dos slides (espelha o schema do backend). */
export interface SlideGerado {
  role: "introduction" | "development" | "conclusion";
  title: string;
  subtitle?: string;
  content: string[];
  speakerNotes?: string;
  visual?: SlideVisual;
}

export interface Apresentacao {
  title: string;
  subtitle?: string;
  slides: SlideGerado[];
}

export interface AlternativaGerada {
  label: string;
  text: string;
  isCorrect: boolean;
  explanationIfIncorrect?: string;
}

export interface QuestaoGerada {
  statement: string;
  alternatives: AlternativaGerada[];
  explanationCorrect: string;
  competency?: string;
  difficulty?: string;
  technicalReference?: string;
}

export interface SimuladoGerado {
  title: string;
  questions: QuestaoGerada[];
}

export interface SecaoResumo {
  heading: string;
  paragraphs: string[];
  callout?: string;
}

export interface ResumoGerado {
  title: string;
  introduction: string;
  sections: SecaoResumo[];
  closing?: string;
}

/** Simulado como o aluno recebe: sem gabarito até o professor liberar. */
export interface SimuladoAluno {
  title: string;
  aulaTitulo: string;
  questions: {
    statement: string;
    alternatives: { label: string; text: string }[];
  }[];
  resultado: ResultadoSimulado | null;
  gabaritoLiberado: boolean;
}

export interface ResultadoSimulado {
  acertos: number;
  total: number;
  percentual: number;
  submittedAt: string;
  correcao: {
    statement: string;
    escolhida: string | null;
    correta: string;
    acertou: boolean;
    explicacao: string;
    alternativas: {
      label: string;
      text: string;
      isCorrect: boolean;
      explicacaoSeIncorreta?: string;
    }[];
  }[];
}

export type TipoReferencia = "artigo" | "video" | "livro" | "site";

export interface Referencia {
  title: string;
  type: TipoReferencia;
  description: string;
  url?: string;
}

export interface MaterialComplementarGerado {
  title: string;
  introduction: string;
  references: Referencia[];
}

export interface ResultadosSimuladoProfessor {
  totalRespondentes: number;
  mediaPercentual: number;
  tentativas: {
    usuarioId: string;
    nome: string | null;
    acertos: number;
    total: number;
    percentual: number;
    submittedAt: string;
  }[];
}

const base = (aulaId: string, blocoId: string) =>
  `/api/aulas/${aulaId}/blocos/${blocoId}/materiais`;

/** Gera o material do bloco — sem prompt, a partir do contexto da aula. */
export async function gerarMaterial(
  aulaId: string,
  blocoId: string,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/gerar`,
    {},
  );
  return data;
}

/**
 * Baixa o arquivo renderizado sob demanda (`responseType: "blob"`), respeitando
 * o nome que vem no `Content-Disposition`.
 */
export async function baixarMaterial(
  aulaId: string,
  blocoId: string,
  nomeSugerido: string,
): Promise<void> {
  const { data, headers } = await hackatonApi.get(
    `${base(aulaId, blocoId)}/download`,
    { responseType: "blob" },
  );

  const disposition = String(headers?.["content-disposition"] ?? "");
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? nomeSugerido;

  const url = URL.createObjectURL(data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function getResultadosSimulado(
  aulaId: string,
  blocoId: string,
): Promise<ResultadosSimuladoProfessor> {
  const { data } = await hackatonApi.get<ResultadosSimuladoProfessor>(
    `${base(aulaId, blocoId)}/simulado/resultados`,
  );
  return data;
}

/** Disponibiliza (ou recolhe) o material de pós-aula para a turma. */
export async function publicarPosAula(
  aulaId: string,
  blocoId: string,
  publicado: boolean,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/publicar`,
    { publicado },
  );
  return data;
}

/** Libera (ou oculta) o gabarito comentado do simulado. */
export async function definirGabarito(
  aulaId: string,
  blocoId: string,
  liberado: boolean,
): Promise<Bloco> {
  const { data } = await hackatonApi.post<Bloco>(
    `${base(aulaId, blocoId)}/simulado/gabarito`,
    { liberado },
  );
  return data;
}

// ------------------------------------------------------------------ aluno

const baseAluno = (sessaoId: string, blocoId: string) =>
  `/api/sessoes/${sessaoId}/blocos/${blocoId}/materiais`;

/**
 * Simulado é **pós-aula**: tem página própria, fora da sessão ao vivo. O acesso
 * depende de o professor ter disponibilizado, não de a aula estar acontecendo.
 */
export async function getSimulado(blocoId: string): Promise<SimuladoAluno> {
  const { data } = await hackatonApi.get<SimuladoAluno>(
    `/api/simulados/${blocoId}`,
  );
  return data;
}

export async function responderSimuladoPorBloco(
  blocoId: string,
  respostas: { questaoIndex: number; alternativaLabel: string | null }[],
): Promise<ResultadoSimulado> {
  const { data } = await hackatonApi.post<ResultadoSimulado>(
    `/api/simulados/${blocoId}/responder`,
    { respostas },
  );
  return data;
}

export async function getSlidesAluno(
  sessaoId: string,
  blocoId: string,
): Promise<Apresentacao> {
  const { data } = await hackatonApi.get<Apresentacao>(
    `${baseAluno(sessaoId, blocoId)}/slides`,
  );
  return data;
}

/** Base da API, para quando precisamos montar URL absoluta. */
export const apiBase = Environment.VITE_HACKATON_API_URL ?? "";
