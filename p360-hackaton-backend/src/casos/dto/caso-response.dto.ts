/** Caso clínico do acervo, na forma consumida pelo frontend (aba Criar). */
export interface CasoResponseDto {
  id: string;
  titulo: string;
  descricao: string;
  /** Especialidade (área), ex.: "Cardiologia". */
  area: string | null;
  /** Tema/diagnóstico, ex.: "Insuficiência cardíaca". */
  tema: string | null;
  /** Palavras-chave do catálogo (catalogo_tags). */
  tags: string | null;
  /** Nome do arquivo de imagem (catalogo_imagem/catalogo_img). O front monta
   *  a URL com STORAGE_URL + "catalogo/" + imagem. */
  imagem: string | null;
}

/** Resultado paginado da busca de casos. */
export interface CasosSearchResult {
  items: CasoResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
