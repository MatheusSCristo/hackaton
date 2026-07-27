import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  criarAula,
  getAula,
  getInsights,
  getOverview,
  removerAula,
  type CriarAulaPayload,
} from "@/services/aulas";

export function useOverview() {
  return useQuery({
    queryKey: ["aulas", "overview"],
    queryFn: getOverview,
    staleTime: 30_000,
  });
}

export function useAula(aulaId: string | undefined) {
  return useQuery({
    queryKey: ["aulas", aulaId],
    queryFn: () => getAula(aulaId as string),
    enabled: Boolean(aulaId),
  });
}

export function useInsights() {
  return useQuery({
    queryKey: ["aulas", "insights"],
    queryFn: getInsights,
    staleTime: 60_000,
  });
}

export function useCriarAula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CriarAulaPayload) => criarAula(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas"] });
    },
  });
}

export function useRemoverAula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (aulaId: string) => removerAula(aulaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aulas"] });
    },
  });
}
