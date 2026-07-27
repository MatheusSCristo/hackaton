import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";

import { LegacyUser } from "../auth/legacy-user.decorator";
import { legacyEmpId, requireProfessorId } from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import { AulasService } from "./aulas.service";
import { AulasInsightsService } from "./aulas-insights.service";
import { BlocosService } from "./blocos.service";
import { CreateAulaDto } from "./dto/create-aula.dto";
import {
  ApplyTemplateDto,
  CreateBlocoDto,
  ReorderBlocosDto,
  UpdateBlocoDto,
} from "./dto/bloco.dto";
import type { BlocoDto } from "./dto/bloco.dto";
import type {
  AulaDto,
  InsightsDto,
  OverviewDto,
} from "./dto/aula-response.dto";

@Controller("aulas")
export class AulasController {
  constructor(
    private readonly aulasService: AulasService,
    private readonly insightsService: AulasInsightsService,
    private readonly blocosService: BlocosService,
  ) {}

  /** Overview do professor: KPIs + lista de aulas criadas. */
  @Get("overview")
  async overview(
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<OverviewDto> {
    return this.aulasService.overview(requireProfessorId(user));
  }

  /** Dicas da IA sobre o que reforçar, com base no desempenho da turma. */
  @Get("insights")
  async insights(
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<InsightsDto> {
    return this.insightsService.generate(requireProfessorId(user));
  }

  /** Salva uma nova aula (aparece no overview). */
  @Post()
  async create(
    @Body() dto: CreateAulaDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<AulaDto> {
    return this.aulasService.create(
      requireProfessorId(user),
      legacyEmpId(user),
      dto,
    );
  }

  /** Uma aula do professor (cockpit da sessão). Declarado após as rotas fixas. */
  @Get(":id")
  async findOne(
    @Param("id") aulaId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<AulaDto> {
    return this.aulasService.findOne(requireProfessorId(user), aulaId);
  }

  // ------------------------------------------------------------------
  // Blocos — a sequência da sessão. Ordem livre; templates são só semente.
  // ------------------------------------------------------------------

  @Get(":id/blocos")
  async listBlocos(
    @Param("id") aulaId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto[]> {
    return this.blocosService.list(aulaId, requireProfessorId(user));
  }

  @Post(":id/blocos")
  async addBloco(
    @Param("id") aulaId: string,
    @Body() dto: CreateBlocoDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.blocosService.create(aulaId, requireProfessorId(user), dto);
  }

  /** Reordena a sequência inteira (exige todos os IDs da aula). */
  @Put(":id/blocos/reorder")
  async reorderBlocos(
    @Param("id") aulaId: string,
    @Body() dto: ReorderBlocosDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto[]> {
    return this.blocosService.reorder(aulaId, requireProfessorId(user), dto);
  }

  @Patch(":id/blocos/:blocoId")
  async updateBloco(
    @Param("id") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: UpdateBlocoDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.blocosService.update(
      aulaId,
      blocoId,
      requireProfessorId(user),
      dto,
    );
  }

  @Delete(":id/blocos/:blocoId")
  @HttpCode(204)
  async removeBloco(
    @Param("id") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<void> {
    await this.blocosService.remove(aulaId, blocoId, requireProfessorId(user));
  }

  /** Substitui a sequência pelos blocos-semente do template escolhido. */
  @Post(":id/apply-template")
  async applyTemplate(
    @Param("id") aulaId: string,
    @Body() dto: ApplyTemplateDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto[]> {
    return this.blocosService.applyTemplate(
      aulaId,
      requireProfessorId(user),
      dto,
    );
  }
}
