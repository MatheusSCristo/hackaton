import { hackatonApi } from "@/api/api";
import Environment from "@/config/env";
import { areaColorFor, type CasoAcervo } from "@/components/pages/aula/data";

/** Forma crua de um caso devolvido por GET /api/casos/search. */
interface CasoResponseDto {
  id: string;
  titulo: string;
  descricao: string;
  area: string | null;
  tema: string | null;
  tags: string | null;
  imagem: string | null;
}

interface CasosSearchResultDto {
  items: CasoResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CasosPage {
  items: CasoAcervo[];
  total: number;
  page: number;
  pageSize: number;
}

/** Exportado para reaproveitar a mesma regra de URL na listagem de aulas. */
export function buildFotoUrl(imagem: string | null): string | null {
  if (!imagem) return null;
  const base = Environment.VITE_STORAGE_URL.endsWith("/")
    ? Environment.VITE_STORAGE_URL
    : `${Environment.VITE_STORAGE_URL}/`;
  return `${base}catalogo/${imagem}`;
}

function toCasoAcervo(dto: CasoResponseDto): CasoAcervo {
  return {
    id: dto.id,
    area: dto.area ?? "",
    areaColor: areaColorFor(dto.area),
    titulo: dto.titulo,
    descricao: dto.descricao,
    chips: dto.tema ? [dto.tema] : [],
    fotoUrl: buildFotoUrl(dto.imagem),
  };
}

export interface CasosSemanticResult {
  items: CasoAcervo[];
  /** false = a busca caiu para textual (sem chave Anthropic no backend). */
  semantic: boolean;
}

/** Busca semântica por tema (rerank via Claude no backend). */
export async function semanticSearchCasos(
  tema: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<CasosSemanticResult> {
  const { data } = await hackatonApi.get<{
    items: CasoResponseDto[];
    semantic: boolean;
  }>("/api/casos/semantic-search", {
    params: { tema: tema.trim(), limit },
    signal,
  });

  return { items: data.items.map(toCasoAcervo), semantic: data.semantic };
}

/** Busca paginada de casos do acervo por tema/termo. */
export async function searchCasos(
  q: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<CasosPage> {
  const params: Record<string, string | number> = { page, pageSize };
  if (q.trim()) params.q = q.trim();

  const { data } = await hackatonApi.get<CasosSearchResultDto>(
    "/api/casos/search",
    { params, signal },
  );

  return {
    items: data.items.map(toCasoAcervo),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}
