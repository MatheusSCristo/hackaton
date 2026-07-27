import {
  BookOpen,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Layers,
  MessagesSquare,
  Network,
  NotebookPen,
  Presentation,
  Rocket,
  Route,
  Stethoscope,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { CustomOption } from "@cursosactive/p360-new-ui";

export interface CasoAcervo {
  id: string;
  area: string;
  /** Chakra colorPalette usada na tag da especialidade. */
  areaColor: string;
  titulo: string;
  descricao: string;
  chips: string[];
  /** URL absoluta da foto do caso (ou null quando sem imagem). */
  fotoUrl: string | null;
}

/** Mapa especialidade → colorPalette do Chakra (para a tag colorida do card). */
const AREA_COLORS: Record<string, string> = {
  cardiologia: "blue",
  infectologia: "green",
  pneumologia: "teal",
  neurologia: "purple",
  pediatria: "pink",
  endocrinologia: "orange",
  "clinica medica": "cyan",
  "clínica médica": "cyan",
  gastroenterologia: "yellow",
  nefrologia: "red",
  psiquiatria: "purple",
  ginecologia: "pink",
  ortopedia: "orange",
};

/** Deriva a cor da tag a partir do nome da área (case/acento-insensível). */
export function areaColorFor(area?: string | null): string {
  if (!area) return "gray";
  const key = area
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return AREA_COLORS[key] ?? "gray";
}

export const casos: CasoAcervo[] = [
  {
    id: "ic",
    area: "Cardiologia",
    areaColor: "blue",
    titulo: "IC compensada × descompensada",
    descricao:
      "Paciente 58 anos, dispneia progressiva, edema MMII, ortopneia. Diagnóstico diferencial e conduta.",
    chips: ["6º período", "Intermediário", "45 min"],
    fotoUrl: null,
  },
  {
    id: "sepse",
    area: "Infectologia",
    areaColor: "green",
    titulo: "Sepse nas primeiras horas",
    descricao:
      "Paciente 42 anos, febre, taquicardia, hipotensão. Reconhecimento precoce e bundle inicial.",
    chips: ["Internato", "Avançado", "60 min"],
    fotoUrl: null,
  },
];

const toOptions = (values: string[]): CustomOption[] =>
  values.map((value) => ({ value, label: value }));

export const publicoOptions = toOptions([
  "4º período",
  "5º período",
  "6º período",
  "Internato",
  "Residência",
]);

export const duracaoOptions = toOptions([
  "30 minutos",
  "50 minutos",
  "60 minutos",
  "90 minutos",
]);

export const formatoOptions = toOptions([
  "Expositiva + caso",
  "Somente caso",
  "PBL (problem-based)",
  "Discussão guiada",
]);

/** Seções da aba Materiais, na ordem de exibição. */
export const SECOES_MATERIAL = [
  "Sala de aula",
  "Estudo individual",
  "Trilha adaptativa",
] as const;

export type SecaoMaterial = (typeof SECOES_MATERIAL)[number];

export interface TipoMaterial {
  id: string;
  secao: SecaoMaterial;
  icon: LucideIcon;
  /** Chakra colorPalette do ícone. */
  color: string;
  titulo: string;
  descricao: string;
  /** Rótulo curto para o badge de "Selecionados". */
  badge: string;
  /** Disponível para seleção; os demais aparecem desabilitados. */
  enabled: boolean;
}

/** Tipos de material que a IA gera a partir do caso/tema escolhido. */
export const tiposMaterial: TipoMaterial[] = [
  // ---- Sala de aula ----
  {
    id: "ppt",
    secao: "Sala de aula",
    icon: Presentation,
    color: "blue",
    titulo: "Apresentação PPT",
    descricao: "Slides editáveis, estruturados em torno do caso.",
    badge: "PPT",
    enabled: true,
  },
  {
    id: "quiz",
    secao: "Sala de aula",
    icon: Vote,
    color: "purple",
    titulo: "Quiz ao vivo",
    descricao: "Votação em tempo real durante a aula.",
    badge: "Quiz ao vivo",
    enabled: true,
  },
  {
    id: "caso360",
    secao: "Sala de aula",
    icon: Stethoscope,
    color: "cyan",
    titulo: "Caso Paciente 360",
    descricao: "Caso clínico interativo integrado à aula.",
    badge: "Caso Paciente 360",
    enabled: true,
  },
  {
    id: "roteiro-discussao",
    secao: "Sala de aula",
    icon: MessagesSquare,
    color: "teal",
    titulo: "Roteiro de discussão",
    descricao: "Perguntas para conduzir a turma.",
    badge: "Roteiro",
    enabled: false,
  },
  {
    id: "rubrica",
    secao: "Sala de aula",
    icon: ClipboardCheck,
    color: "green",
    titulo: "Rubrica de avaliação",
    descricao: "Critérios para avaliar o desempenho no caso.",
    badge: "Rubrica",
    enabled: false,
  },
  {
    id: "roteiro-video",
    secao: "Sala de aula",
    icon: Clapperboard,
    color: "orange",
    titulo: "Roteiro de vídeo-aula",
    descricao: "Script para gravação assíncrona.",
    badge: "Vídeo-aula",
    enabled: false,
  },
  // ---- Estudo individual ----
  {
    id: "simulado",
    secao: "Estudo individual",
    icon: ClipboardList,
    color: "green",
    titulo: "Simulado",
    descricao: "Questões comentadas por competência.",
    badge: "Simulado",
    enabled: true,
  },
  {
    id: "flashcards",
    secao: "Estudo individual",
    icon: Layers,
    color: "yellow",
    titulo: "Flash cards",
    descricao: "Revisão rápida dos conceitos-chave.",
    badge: "Flash cards",
    enabled: false,
  },
  {
    id: "resumo",
    secao: "Estudo individual",
    icon: FileText,
    color: "blue",
    titulo: "Resumo da aula",
    descricao: "Síntese para disponibilizar aos alunos.",
    badge: "Resumo",
    enabled: true,
  },
  {
    id: "leitura",
    secao: "Estudo individual",
    icon: BookOpen,
    color: "orange",
    titulo: "Leitura complementar",
    descricao: "Referências e artigos sobre o tema.",
    badge: "Leitura",
    enabled: true,
  },
  {
    id: "atividade",
    secao: "Estudo individual",
    icon: NotebookPen,
    color: "pink",
    titulo: "Atividade para casa",
    descricao: "Exercício de aplicação pós-aula.",
    badge: "Atividade",
    enabled: false,
  },
  {
    id: "mapa",
    secao: "Estudo individual",
    icon: Network,
    color: "purple",
    titulo: "Mapa conceitual",
    descricao: "Organização visual dos conceitos.",
    badge: "Mapa",
    enabled: false,
  },
  // ---- Trilha adaptativa ----
  {
    id: "trilha-reforco",
    secao: "Trilha adaptativa",
    icon: Route,
    color: "red",
    titulo: "Trilha de reforço",
    descricao: "Conteúdo extra para quem teve mais dificuldade.",
    badge: "Trilha de reforço",
    enabled: false,
  },
  {
    id: "trilha-aprofundamento",
    secao: "Trilha adaptativa",
    icon: Rocket,
    color: "cyan",
    titulo: "Trilha de aprofundamento",
    descricao: "Desafios para quem foi bem no caso.",
    badge: "Aprofundamento",
    enabled: false,
  },
];
