import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  coletarCaso,
  encerrarCaso,
  getProgressoCaso,
  getTurmas,
  liberarCaso,
  prepararCaso,
} from "@/services/caso";

export function useTurmas(
  aulaId: string | undefined,
  blocoId: string | undefined,
) {
  return useQuery({
    queryKey: ["caso", aulaId, blocoId, "turmas"],
    queryFn: () => getTurmas(aulaId as string, blocoId as string),
    enabled: Boolean(aulaId && blocoId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Contador "X de Y concluíram". Consulta leve e periódica — não é stream de
 * progresso; serve para o professor decidir quando encerrar.
 */
export function useProgressoCaso(
  aulaId: string | undefined,
  blocoId: string | undefined,
  ativo: boolean,
) {
  return useQuery({
    queryKey: ["caso", aulaId, blocoId, "progresso"],
    queryFn: () => getProgressoCaso(aulaId as string, blocoId as string),
    enabled: Boolean(aulaId && blocoId) && ativo,
    refetchInterval: ativo ? 20_000 : false,
  });
}

function useInvalidate(aulaId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
    qc.invalidateQueries({ queryKey: ["aulas", aulaId, "sessao"] });
    qc.invalidateQueries({ queryKey: ["caso", aulaId] });
  };
}

export function usePrepararCaso(aulaId: string | undefined) {
  const invalidate = useInvalidate(aulaId);
  return useMutation({
    mutationFn: (blocoId: string) => prepararCaso(aulaId as string, blocoId),
    onSuccess: invalidate,
  });
}

export function useLiberarCaso(aulaId: string | undefined) {
  const invalidate = useInvalidate(aulaId);
  return useMutation({
    mutationFn: ({
      blocoId,
      sessaoId,
    }: {
      blocoId: string;
      sessaoId: string;
    }) => liberarCaso(aulaId as string, blocoId, sessaoId),
    onSuccess: invalidate,
  });
}

export function useEncerrarCaso(aulaId: string | undefined) {
  const invalidate = useInvalidate(aulaId);
  return useMutation({
    mutationFn: ({
      blocoId,
      sessaoId,
    }: {
      blocoId: string;
      sessaoId: string;
    }) => encerrarCaso(aulaId as string, blocoId, sessaoId),
    onSuccess: invalidate,
  });
}

export function useColetarCaso(aulaId: string | undefined) {
  const invalidate = useInvalidate(aulaId);
  return useMutation({
    mutationFn: (blocoId: string) => coletarCaso(aulaId as string, blocoId),
    onSuccess: invalidate,
  });
}
