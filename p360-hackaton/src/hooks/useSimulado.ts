import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  definirGabarito,
  getSimulado,
  publicarPosAula,
  responderSimuladoPorBloco,
} from "@/services/materiais";

/** Simulado do aluno — página própria, fora da sessão ao vivo. */
export function useSimulado(blocoId: string | undefined, alunoToken: string) {
  return useQuery({
    queryKey: ["simulado", blocoId, alunoToken],
    queryFn: () => getSimulado(blocoId as string, alunoToken),
    enabled: Boolean(blocoId),
    retry: false,
  });
}

export function useResponderSimuladoPorBloco(
  blocoId: string | undefined,
  alunoToken: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      respostas: { questaoIndex: number; alternativaLabel: string | null }[],
    ) => responderSimuladoPorBloco(blocoId as string, alunoToken, respostas),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulado", blocoId, alunoToken] });
    },
  });
}

// ------------------------------------------------------------- professor

function useInvalidateBlocos(aulaId: string | undefined) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
}

export function usePublicarPosAula(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: ({
      blocoId,
      publicado,
    }: {
      blocoId: string;
      publicado: boolean;
    }) => publicarPosAula(aulaId as string, blocoId, publicado),
    onSuccess: invalidate,
  });
}

export function useDefinirGabarito(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: ({
      blocoId,
      liberado,
    }: {
      blocoId: string;
      liberado: boolean;
    }) => definirGabarito(aulaId as string, blocoId, liberado),
    onSuccess: invalidate,
  });
}
