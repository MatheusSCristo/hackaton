import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { searchCasos } from "@/services/casos";

export const CASOS_PAGE_SIZE = 6;

/**
 * Busca paginada de casos do acervo por tema/termo (`q`). Passa o
 * `AbortSignal` do react-query ao axios — a requisição anterior é
 * cancelada automaticamente quando `q`/página mudam.
 */
export function useSearchCasos(
  q: string,
  page: number,
  enabled = true,
  pageSize = CASOS_PAGE_SIZE,
) {
  return useQuery({
    queryKey: ["casos", "search", q, page, pageSize],
    queryFn: ({ signal }) => searchCasos(q, page, pageSize, signal),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
