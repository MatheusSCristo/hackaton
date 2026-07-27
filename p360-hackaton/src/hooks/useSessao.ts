import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  criarSessao,
  encerrarBloco,
  encerrarSessao,
  getSessaoAtual,
  liberarBloco,
} from "@/services/sessao";

export function useSessaoAtual(aulaId: string | undefined) {
  return useQuery({
    queryKey: ["aulas", aulaId, "sessao"],
    queryFn: () => getSessaoAtual(aulaId as string),
    enabled: Boolean(aulaId),
  });
}

function useInvalidateSessao(aulaId: string | undefined) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["aulas", aulaId, "sessao"] });
}

export function useCriarSessao(aulaId: string | undefined) {
  const invalidate = useInvalidateSessao(aulaId);
  return useMutation({
    mutationFn: () => criarSessao(aulaId as string),
    onSuccess: invalidate,
  });
}

export function useLiberarBloco(aulaId: string | undefined) {
  const invalidate = useInvalidateSessao(aulaId);
  return useMutation({
    mutationFn: ({
      sessaoId,
      blocoId,
    }: {
      sessaoId: string;
      blocoId: string;
    }) => liberarBloco(sessaoId, blocoId),
    onSuccess: invalidate,
  });
}

export function useEncerrarBloco(aulaId: string | undefined) {
  const invalidate = useInvalidateSessao(aulaId);
  return useMutation({
    mutationFn: ({
      sessaoId,
      blocoId,
    }: {
      sessaoId: string;
      blocoId: string;
    }) => encerrarBloco(sessaoId, blocoId),
    onSuccess: invalidate,
  });
}

export function useEncerrarSessao(aulaId: string | undefined) {
  const invalidate = useInvalidateSessao(aulaId);
  return useMutation({
    mutationFn: (sessaoId: string) => encerrarSessao(sessaoId),
    onSuccess: invalidate,
  });
}
