import { useMutation, useQueryClient } from "@tanstack/react-query";

import { prepararAula } from "@/services/preparacao";

/**
 * Prepara a aula inteira antes de apresentar.
 *
 * Invalida os blocos no sucesso porque o preparo escreve no `output` de vários
 * deles (slides gerados, `cursoLegacyId` do caso, pacote da enquete) — sem isso
 * a tela de apresentação abriria com dados velhos.
 */
export function usePrepararAula(aulaId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => prepararAula(aulaId as string),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["aulas", aulaId, "blocos"] }),
  });
}
