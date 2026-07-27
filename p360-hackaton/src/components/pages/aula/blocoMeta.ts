import {
  ClipboardList,
  FileText,
  Presentation,
  Route,
  Stethoscope,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { TipoBloco } from "@/services/blocos";

/**
 * Quando o bloco acontece: `sessao` é conduzido ao vivo na aula; `pos_aula` é
 * fixação de conteúdo, que o aluno faz em casa no próprio tempo.
 */
export type MomentoBloco = "sessao" | "pos_aula";

export interface BlocoMeta {
  tipo: TipoBloco;
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  /** Chakra colorPalette do ícone. */
  color: string;
  momento: MomentoBloco;
  /** Blocos ainda não implementados aparecem desabilitados. */
  enabled: boolean;
}

/**
 * Catálogo de blocos que o professor pode encaixar na sessão. A ordem aqui é só
 * a de exibição no menu — a sequência da aula é livre.
 */
export const BLOCO_META: Record<TipoBloco, BlocoMeta> = {
  slides: {
    tipo: "slides",
    momento: "sessao",
    titulo: "Slides",
    descricao: "Apresentação da aula, gerada em torno do caso ou tema.",
    icon: Presentation,
    color: "blue",
    enabled: true,
  },
  enquete: {
    tipo: "enquete",
    momento: "sessao",
    titulo: "Enquete ao vivo",
    descricao: "Questões geradas por IA; alunos respondem por PIN/QR.",
    icon: Vote,
    color: "purple",
    enabled: true,
  },
  caso: {
    tipo: "caso",
    momento: "sessao",
    titulo: "Caso clínico",
    descricao: "Caso do acervo — apresentado por você ou resolvido pela turma.",
    icon: Stethoscope,
    color: "cyan",
    enabled: true,
  },
  simulado: {
    tipo: "simulado",
    momento: "pos_aula",
    titulo: "Simulado",
    descricao: "Questões comentadas para o aluno responder no próprio tempo.",
    icon: ClipboardList,
    color: "green",
    enabled: true,
  },
  resumo: {
    tipo: "resumo",
    momento: "pos_aula",
    titulo: "Resumo da aula",
    descricao: "Material de estudo em PDF, gerado a partir da aula.",
    icon: FileText,
    color: "orange",
    enabled: true,
  },
  reforco: {
    tipo: "reforco",
    momento: "pos_aula",
    titulo: "Trilha de reforço",
    descricao: "Material extra sobre os pontos que a turma errou.",
    icon: Route,
    color: "red",
    enabled: false,
  },
};

/** Blocos conduzidos ao vivo, na sequência da aula. */
export const BLOCOS_SESSAO: BlocoMeta[] = [
  BLOCO_META.slides,
  BLOCO_META.caso,
  BLOCO_META.enquete,
];

/** Materiais de fixação, que o aluno faz em casa depois da aula. */
export const BLOCOS_POS_AULA: BlocoMeta[] = [
  BLOCO_META.simulado,
  BLOCO_META.resumo,
  BLOCO_META.reforco,
];

export function momentoDoTipo(tipo: string): MomentoBloco {
  return BLOCO_META[tipo as TipoBloco]?.momento ?? "sessao";
}

/** Resumo curto da config, para a linha do bloco na lista. */
export function resumoConfig(
  tipo: TipoBloco,
  config: Record<string, unknown>,
): string | null {
  if (tipo === "enquete") {
    const foco =
      config.foco === "fraquezas" ? "focada nos pontos fracos" : "geral";
    const n = typeof config.nPerguntas === "number" ? config.nPerguntas : 5;
    return `${n} ${n === 1 ? "questão" : "questões"} · ${foco}`;
  }

  if (tipo === "slides" && typeof config.nSlides === "number") {
    return `${config.nSlides} slides`;
  }

  if (tipo === "simulado" && typeof config.nQuestoes === "number") {
    return `${config.nQuestoes} questões`;
  }

  return null;
}
