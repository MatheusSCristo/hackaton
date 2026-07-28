import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  baixarMaterial,
  enviarBaseDeSlides,
  gerarMaterial,
  getResultadosSimulado,
  getSlidesAluno,
  removerBaseDeSlides,
} from "@/services/materiais";

export function useGerarMaterial(aulaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocoId: string) => gerarMaterial(aulaId as string, blocoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
    },
  });
}

export function useBaixarMaterial(aulaId: string | undefined) {
  return useMutation({
    mutationFn: ({
      blocoId,
      nomeSugerido,
    }: {
      blocoId: string;
      nomeSugerido: string;
    }) => baixarMaterial(aulaId as string, blocoId, nomeSugerido),
  });
}

/**
 * Slide pessoal do professor como base da geração.
 *
 * A rota e o parsing do `.pptx` já existem no backend; o que está desligado é o
 * botão (ver `BaseDeSlides` em `MaterialBloco`). Ligar de novo é trocar o
 * componente do botão por um que chame estes hooks.
 */
export function useDefinirBaseDeSlides(aulaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ blocoId, arquivo }: { blocoId: string; arquivo: File }) =>
      enviarBaseDeSlides(aulaId as string, blocoId, arquivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
    },
  });
}

export function useRemoverBaseDeSlides(aulaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocoId: string) =>
      removerBaseDeSlides(aulaId as string, blocoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
    },
  });
}

export function useResultadosSimulado(
  aulaId: string | undefined,
  blocoId: string | undefined,
  ativo: boolean,
) {
  return useQuery({
    queryKey: ["materiais", aulaId, blocoId, "resultados"],
    queryFn: () => getResultadosSimulado(aulaId as string, blocoId as string),
    enabled: Boolean(aulaId && blocoId) && ativo,
    refetchInterval: ativo ? 30_000 : false,
  });
}

// ------------------------------------------------------------------ aluno

export function useSlidesAluno(
  sessaoId: string | undefined,
  blocoId: string | undefined,
) {
  return useQuery({
    queryKey: ["sala", sessaoId, blocoId, "slides"],
    queryFn: () => getSlidesAluno(sessaoId as string, blocoId as string),
    enabled: Boolean(sessaoId && blocoId),
  });
}
