import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { semanticSearchCasos } from "@/services/casos";

/** Mínimo de caracteres para disparar a busca semântica. */
export const SEMANTIC_MIN_CHARS = 3;

/**
 * Busca semântica de casos por tema (rerank via Claude no backend).
 * Só dispara com ≥ {@link SEMANTIC_MIN_CHARS} caracteres; passa o
 * `AbortSignal` do react-query ao axios (cancela a busca anterior).
 */
export function useSemanticCasos(tema: string, enabled = true) {
  const term = tema.trim();
  return useQuery({
    queryKey: ["casos", "semantic", term],
    queryFn: ({ signal }) => semanticSearchCasos(term, 10, signal),
    enabled: enabled && term.length >= SEMANTIC_MIN_CHARS,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
