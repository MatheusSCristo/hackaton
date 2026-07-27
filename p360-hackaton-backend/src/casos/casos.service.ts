import { Injectable } from "@nestjs/common";

import { LegacyDbService } from "../legacy-db/legacy-db.service";
import type {
  CasoResponseDto,
  CasosSearchResult,
} from "./dto/caso-response.dto";

interface CasoRow {
  id: number | string;
  titulo: string | null;
  descricao: string | null;
  area: string | null;
  tema: string | null;
  tags: string | null;
  imagem: string | null;
}

interface CountRow {
  total: number;
}

const DEFAULT_PAGE_SIZE = 6;

@Injectable()
export class CasosService {
  constructor(private readonly legacyDb: LegacyDbService) {}

  /**
   * Busca paginada de casos clínicos do acervo da empresa do professor.
   *
   * Visibilidade: `versao = 2`, `tpc_id = 1` (não-retorno) e o caso acessível
   * à empresa — atribuído diretamente (`empresacaso`) OU parte das aulas dos
   * cursos liberados (`empresacurso` → `cursoaula`). Com `q`, filtra por
   * especialidade/tema/tags/nome via `unaccent ILIKE` (query parametrizada).
   */
  async search(
    empId: number,
    q?: string,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<CasosSearchResult> {
    // WHERE + params compartilhados entre a contagem e a página.
    const params: unknown[] = [empId];
    // Casos acessíveis à empresa: atribuídos diretamente (empresacaso) OU
    // que fazem parte das aulas dos cursos liberados para a empresa
    // (empresacurso → cursoaula.caso_id).
    let where =
      "c.versao = 2 AND c.tpc_id = 1 AND (" +
      " c.id IN (SELECT caso_id FROM empresacaso WHERE emp_id = $1)" +
      " OR c.id IN (" +
      "   SELECT ca.caso_id FROM cursoaula ca" +
      "   JOIN empresacurso ec ON ec.curso_id = ca.curso_id" +
      "   WHERE ec.emp_id = $1 AND ca.caso_id IS NOT NULL" +
      " )" +
      ")";

    const term = q?.trim();
    if (term) {
      params.push(`%${term}%`);
      const p = `$${params.length}`;
      where +=
        ` AND (` +
        ` c.esp_id IN (SELECT id FROM especialidade WHERE unaccent(descricao) ILIKE unaccent(${p}))` +
        ` OR c.tem_id IN (SELECT id FROM tema WHERE unaccent(nome) ILIKE unaccent(${p}))` +
        ` OR unaccent(coalesce(c.catalogo_tags, '')) ILIKE unaccent(${p})` +
        ` OR unaccent(coalesce(c.catalogo_nome, c.nome, '')) ILIKE unaccent(${p})` +
        ` )`;
    }

    const [{ total }] = await this.legacyDb.query<CountRow>(
      `SELECT count(*)::int AS total FROM caso c WHERE ${where}`,
      params,
    );

    const offset = (page - 1) * pageSize;
    const pageParams = [...params, pageSize, offset];
    const limitParam = `$${pageParams.length - 1}`;
    const offsetParam = `$${pageParams.length}`;

    const sql =
      `SELECT c.id,` +
      ` coalesce(c.catalogo_nome, c.nome) AS titulo,` +
      ` coalesce(c.catalogo_descricao, c.observacoes) AS descricao,` +
      ` e.descricao AS area,` +
      ` t.nome AS tema,` +
      ` c.catalogo_tags AS tags,` +
      ` coalesce(c.catalogo_imagem, c.catalogo_img) AS imagem` +
      ` FROM caso c` +
      ` LEFT JOIN especialidade e ON e.id = c.esp_id` +
      ` LEFT JOIN tema t ON t.id = c.tem_id` +
      ` WHERE ${where}` +
      ` ORDER BY c.catalogo_data_publicacao DESC NULLS LAST, c.id DESC` +
      ` LIMIT ${limitParam} OFFSET ${offsetParam}`;

    const rows = await this.legacyDb.query<CasoRow>(sql, pageParams);

    const items: CasoResponseDto[] = rows.map((row) => ({
      id: String(row.id),
      titulo: row.titulo ?? "",
      descricao: row.descricao ?? "",
      area: row.area ?? null,
      tema: row.tema ?? null,
      tags: row.tags ?? null,
      imagem: row.imagem ?? null,
    }));

    return { items, total, page, pageSize };
  }
}
