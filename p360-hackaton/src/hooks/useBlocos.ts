import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addBloco,
  applyTemplate,
  getBlocos,
  getTemplates,
  removeBloco,
  reorderBlocos,
  updateBloco,
  type BlocoConfig,
  type TipoBloco,
} from "@/services/blocos";

export function useTemplates() {
  return useQuery({
    queryKey: ["aula-templates"],
    queryFn: getTemplates,
    staleTime: Infinity,
  });
}

export function useBlocos(aulaId: string | undefined) {
  return useQuery({
    queryKey: ["aulas", aulaId, "blocos"],
    queryFn: () => getBlocos(aulaId as string),
    enabled: Boolean(aulaId),
  });
}

/** Invalida a lista de blocos da aula após qualquer mutação da sequência. */
function useInvalidateBlocos(aulaId: string | undefined) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
}

export function useAddBloco(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (payload: { tipo: TipoBloco; config?: BlocoConfig }) =>
      addBloco(aulaId as string, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateBloco(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: ({
      blocoId,
      ...payload
    }: {
      blocoId: string;
      config?: BlocoConfig;
      ordem?: number;
    }) => updateBloco(aulaId as string, blocoId, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveBloco(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (blocoId: string) => removeBloco(aulaId as string, blocoId),
    onSuccess: invalidate,
  });
}

export function useReorderBlocos(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (ordem: string[]) => reorderBlocos(aulaId as string, ordem),
    onSuccess: invalidate,
  });
}

export function useApplyTemplate(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (templateId: string) =>
      applyTemplate(aulaId as string, templateId),
    onSuccess: invalidate,
  });
}
