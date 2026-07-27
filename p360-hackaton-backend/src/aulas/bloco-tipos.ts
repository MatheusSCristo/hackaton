/**
 * Tipos de bloco de uma sessão de aula e os templates de partida.
 *
 * A sessão é uma **sequência livre** de blocos: o professor monta a ordem que
 * quiser. Os templates existem só como ponto de partida — todos editáveis.
 */

export const TIPOS_BLOCO = [
  "slides",
  "caso",
  "enquete",
  "simulado",
  "resumo",
  "reforco",
] as const;
export type TipoBloco = (typeof TIPOS_BLOCO)[number];

export const ORIGENS_BLOCO = ["template", "manual"] as const;
export type OrigemBloco = (typeof ORIGENS_BLOCO)[number];

/**
 * Quando o bloco acontece.
 *
 * - `sessao`: conduzido ao vivo pelo professor, na aula.
 * - `pos_aula`: fixação de conteúdo, o aluno faz em casa no próprio tempo — não
 *   entra na sequência da sessão nem é "liberado" durante a aula.
 */
export const MOMENTOS_BLOCO = ["sessao", "pos_aula"] as const;
export type MomentoBloco = (typeof MOMENTOS_BLOCO)[number];

/** O momento é uma propriedade do tipo, não uma escolha do professor. */
export const MOMENTO_POR_TIPO: Record<TipoBloco, MomentoBloco> = {
  slides: "sessao",
  caso: "sessao",
  enquete: "sessao",
  simulado: "pos_aula",
  resumo: "pos_aula",
  reforco: "pos_aula",
};

export function momentoDoTipo(tipo: string): MomentoBloco {
  return MOMENTO_POR_TIPO[tipo as TipoBloco] ?? "sessao";
}

export function ehPosAula(tipo: string): boolean {
  return momentoDoTipo(tipo) === "pos_aula";
}

/** Blocos já implementados; os demais aparecem desabilitados na UI. */
export const TIPOS_BLOCO_HABILITADOS: readonly TipoBloco[] = [
  "slides",
  "enquete",
  "caso",
  "simulado",
  "resumo",
];

export const FOCOS_ENQUETE = ["geral", "fraquezas"] as const;
export type FocoEnquete = (typeof FOCOS_ENQUETE)[number];

export interface TemplateBloco {
  tipo: TipoBloco;
  config?: Record<string, unknown>;
}

export interface AulaTemplate {
  id: string;
  nome: string;
  descricao: string;
  blocos: TemplateBloco[];
}

/**
 * Templates estáticos. `diagnostica` é o fluxo "slides → caso → reforço →
 * enquete focada"; os outros invertem/encurtam a ordem — e qualquer um pode ser
 * reordenado depois de aplicado.
 */
export const AULA_TEMPLATES: readonly AulaTemplate[] = [
  {
    id: "diagnostica",
    nome: "Diagnóstica",
    descricao:
      "Apresenta, aplica o caso, reforça o que a turma errou e fecha com enquete focada.",
    blocos: [
      { tipo: "slides" },
      { tipo: "caso" },
      { tipo: "reforco" },
      { tipo: "enquete", config: { foco: "fraquezas", nPerguntas: 5 } },
    ],
  },
  {
    id: "pbl",
    nome: "Caso primeiro (PBL)",
    descricao:
      "Começa pelo caso clínico, depois sistematiza em slides e verifica com enquete.",
    blocos: [
      { tipo: "caso" },
      { tipo: "slides" },
      { tipo: "enquete", config: { foco: "fraquezas", nPerguntas: 5 } },
    ],
  },
  {
    id: "revisao",
    nome: "Revisão rápida",
    descricao: "Sonda a turma com uma enquete geral e corrige em seguida.",
    blocos: [
      { tipo: "enquete", config: { foco: "geral", nPerguntas: 5 } },
      { tipo: "slides" },
    ],
  },
  {
    id: "apresentacao",
    nome: "Só apresentação",
    descricao: "Apenas os slides da aula.",
    blocos: [{ tipo: "slides" }],
  },
  {
    id: "branco",
    nome: "Em branco",
    descricao: "Monte a sequência do zero.",
    blocos: [],
  },
];

export function findTemplate(id: string): AulaTemplate | undefined {
  return AULA_TEMPLATES.find((t) => t.id === id);
}
