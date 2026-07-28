import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  atualizarSlideSessao,
  confirmarInicioSessao,
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
    // Enquanto não existe sessão conhecida NESTA aba, não há `codigo` pra
    // conectar o socket (`useSessaoLive`) — então esta aba só descobre que
    // outra janela (a de QR Code) acabou de criar a sessão via polling curto.
    // Assim que a sessão aparece, o socket assume e o polling para sozinho.
    refetchInterval: (query) => (query.state.data ? false : 1500),
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

/** Confirma o início oficial da sessão (tela de QR Code). */
export function useConfirmarInicioSessao(aulaId: string | undefined) {
  const invalidate = useInvalidateSessao(aulaId);
  return useMutation({
    mutationFn: (sessaoId: string) => confirmarInicioSessao(sessaoId),
    onSuccess: invalidate,
  });
}

/** Espelha o slide atual pra turma — sem invalidar a query (o socket já cobre isso ao vivo). */
export function useAtualizarSlideSessao() {
  return useMutation({
    mutationFn: ({
      sessaoId,
      slideAtual,
    }: {
      sessaoId: string;
      slideAtual: number;
    }) => atualizarSlideSessao(sessaoId, slideAtual),
  });
}
