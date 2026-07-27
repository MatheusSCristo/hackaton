import { BadRequestException, Controller, Get, Query } from "@nestjs/common";

import { LegacyUser } from "../auth/legacy-user.decorator";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import { CasosService } from "./casos.service";
import { SemanticSearchService } from "./semantic-search.service";
import type {
  CasoResponseDto,
  CasosSearchResult,
} from "./dto/caso-response.dto";
import { SearchCasosDto } from "./dto/search-casos.dto";
import { SemanticSearchDto } from "./dto/semantic-search.dto";

function requireEmpId(user: LegacyTokenInfo | undefined): number {
  const empId = user?.emp_id;
  if (empId === undefined || empId === null) {
    throw new BadRequestException(
      "Usuário sem empresa associada (emp_id ausente no token).",
    );
  }
  return Number(empId);
}

@Controller("casos")
export class CasosController {
  constructor(
    private readonly casosService: CasosService,
    private readonly semanticService: SemanticSearchService,
  ) {}

  /**
   * Busca textual (ILIKE) paginada do acervo da empresa. Usada no modo
   * "caso clínico" (buscar caso direto por título/especialidade/tema).
   * Protegida pelo AccessTokenGuard global.
   */
  @Get("search")
  async search(
    @Query() query: SearchCasosDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<CasosSearchResult> {
    return this.casosService.search(
      requireEmpId(user),
      query.q,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Busca semântica por tema (rerank via Claude). Usada no modo "tema".
   * `semantic: false` no retorno indica fallback textual (sem chave Anthropic).
   */
  @Get("semantic-search")
  async semanticSearch(
    @Query() query: SemanticSearchDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<{ items: CasoResponseDto[]; semantic: boolean }> {
    const items = await this.semanticService.searchByTheme(
      requireEmpId(user),
      query.tema,
      query.limit,
    );
    return { items, semantic: this.semanticService.enabled };
  }
}
