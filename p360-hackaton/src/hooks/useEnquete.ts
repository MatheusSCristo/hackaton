import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  gerarEnquete,
  iniciarEnquete,
  publicarEnquete,
  registrarResultadoEnquete,
  trocarQuestaoAtual,
  type GerarEnquetePayload,
  type OpcaoResultadoEnquete,
} from "@/services/enquete";

function useInvalidateBlocos(aulaId: string | undefined) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] });
}

export function useGerarEnquete(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: ({
      blocoId,
      ...payload
    }: { blocoId: string } & GerarEnquetePayload) =>
      gerarEnquete(aulaId as string, blocoId, payload),
    onSuccess: invalidate,
  });
}

export function usePublicarEnquete(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (blocoId: string) => publicarEnquete(aulaId as string, blocoId),
    onSuccess: invalidate,
  });
}

export function useIniciarEnquete(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (vars: { blocoId: string; indice?: number }) =>
      iniciarEnquete(aulaId as string, vars.blocoId, vars.indice ?? 0),
    onSuccess: invalidate,
  });
}

/** Só bookkeeping (`questaoAtual`) — a troca ao vivo é via WebSocket direto no poll360. */
export function useTrocarQuestaoAtual(aulaId: string | undefined) {
  const invalidate = useInvalidateBlocos(aulaId);
  return useMutation({
    mutationFn: (vars: { blocoId: string; indice: number }) =>
      trocarQuestaoAtual(aulaId as string, vars.blocoId, vars.indice),
    onSuccess: invalidate,
  });
}

/** Base das métricas de enquete — chamado quando o professor encerra uma questão. */
export function useRegistrarResultadoEnquete(aulaId: string | undefined) {
  return useMutation({
    mutationFn: (vars: {
      blocoId: string;
      questaoIndex: number;
      enunciado: string;
      opcoes: OpcaoResultadoEnquete[];
    }) =>
      registrarResultadoEnquete(aulaId as string, vars.blocoId, {
        questaoIndex: vars.questaoIndex,
        enunciado: vars.enunciado,
        opcoes: vars.opcoes,
      }),
  });
}
