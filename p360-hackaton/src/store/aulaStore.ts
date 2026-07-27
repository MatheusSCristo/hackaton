import { create } from "zustand";

import { momentoDoTipo } from "@/components/pages/aula/blocoMeta";
import type { BlocoConfig, TipoBloco } from "@/services/blocos";

export type StartMode = "caso" | "tema";

/** Campos de texto/seleção editáveis do rascunho da aula. */
export type AulaTextField =
  "tema" | "publico" | "duracao" | "objetivos";

/**
 * Bloco ainda não persistido. Só existe enquanto o professor monta a sequência;
 * ao salvar a aula, os blocos vão para o backend e passam a ter `id` real.
 */
export interface BlocoDraft {
  tempId: string;
  tipo: TipoBloco;
  config: BlocoConfig;
}

export interface AulaState {
  /** Ponto de partida escolhido: a partir de um caso do acervo ou de um tema. */
  mode: StartMode;
  /** Caso selecionado do acervo Paciente 360. */
  selectedCaseId: string | null;
  /** Título do caso selecionado (para salvar/exibir). */
  selectedCaseTitulo: string | null;
  tema: string;
  publico: string;
  duracao: string;
  objetivos: string;
  /** Sequência de blocos da sessão, na ordem montada pelo professor. */
  blocos: BlocoDraft[];
  /** Template usado como ponto de partida (só informativo). */
  templateId: string | null;

  setMode: (mode: StartMode) => void;
  selectCase: (id: string, titulo: string) => void;
  setField: (field: AulaTextField, value: string) => void;

  addBloco: (tipo: TipoBloco, config?: BlocoConfig) => void;
  updateBlocoConfig: (tempId: string, patch: BlocoConfig) => void;
  moveBloco: (tempId: string, direcao: -1 | 1) => void;
  removeBloco: (tempId: string) => void;
  applyTemplateBlocos: (
    templateId: string,
    blocos: { tipo: TipoBloco; config?: BlocoConfig }[],
  ) => void;

  reset: () => void;
}

let seq = 0;
const nextTempId = (): string => `b${++seq}`;

// Formulário começa vazio; nenhum bloco pré-selecionado.
const initialState = {
  mode: "caso" as StartMode,
  selectedCaseId: null as string | null,
  selectedCaseTitulo: null as string | null,
  tema: "",
  publico: "",
  duracao: "",
  objetivos: "",
  blocos: [] as BlocoDraft[],
  templateId: null as string | null,
};

export const useAulaStore = create<AulaState>((set) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  selectCase: (selectedCaseId, selectedCaseTitulo) =>
    set({ selectedCaseId, selectedCaseTitulo }),
  setField: (field, value) =>
    set({ [field]: value } as Pick<AulaState, AulaTextField>),

  addBloco: (tipo, config = {}) =>
    set((state) => ({
      blocos: [...state.blocos, { tempId: nextTempId(), tipo, config }],
    })),

  updateBlocoConfig: (tempId, patch) =>
    set((state) => ({
      blocos: state.blocos.map((bloco) =>
        bloco.tempId === tempId
          ? { ...bloco, config: { ...bloco.config, ...patch } }
          : bloco,
      ),
    })),

  /**
   * Troca com o vizinho **da mesma seção** (sessão ou pós-aula). Sem isso, subir
   * o primeiro material de pós-aula o jogaria no meio da sequência ao vivo.
   */
  moveBloco: (tempId, direcao) =>
    set((state) => {
      const index = state.blocos.findIndex((b) => b.tempId === tempId);
      if (index < 0) return state;

      const momento = momentoDoTipo(state.blocos[index].tipo);
      const vizinho =
        direcao === -1
          ? [...state.blocos.slice(0, index)]
              .reverse()
              .find((b) => momentoDoTipo(b.tipo) === momento)
          : state.blocos
              .slice(index + 1)
              .find((b) => momentoDoTipo(b.tipo) === momento);

      if (!vizinho) return state;
      const destino = state.blocos.findIndex(
        (b) => b.tempId === vizinho.tempId,
      );

      const blocos = [...state.blocos];
      [blocos[index], blocos[destino]] = [blocos[destino], blocos[index]];
      return { blocos };
    }),

  removeBloco: (tempId) =>
    set((state) => ({
      blocos: state.blocos.filter((b) => b.tempId !== tempId),
    })),

  applyTemplateBlocos: (templateId, blocos) =>
    set({
      templateId,
      blocos: blocos.map((bloco) => ({
        tempId: nextTempId(),
        tipo: bloco.tipo,
        config: bloco.config ?? {},
      })),
    }),

  reset: () => set({ ...initialState, blocos: [] }),
}));
