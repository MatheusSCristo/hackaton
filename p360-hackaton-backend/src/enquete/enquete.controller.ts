import {
  Body,
  Controller,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";

import { LegacyToken } from "../auth/legacy-token.decorator";
import { LegacyUser } from "../auth/legacy-user.decorator";
import { requireProfessorId } from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { EnqueteService } from "./enquete.service";
import { GerarEnqueteDto } from "./dto/enquete.dto";

function requireToken(token: string | undefined): string {
  if (!token) {
    throw new UnauthorizedException("X-Access-Token ausente.");
  }
  return token;
}

/**
 * Enquete de um bloco: **gerar** (IA, rascunho) → **publicar** (poll360) →
 * **iniciar** (sessão ao vivo com PIN). Três passos separados de propósito: o
 * professor revisa o conteúdo antes de ele chegar aos alunos.
 */
@Controller("aulas/:aulaId/blocos/:blocoId/enquete")
export class EnqueteController {
  constructor(private readonly enquete: EnqueteService) {}

  @Post("gerar")
  async gerar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: GerarEnqueteDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.enquete.gerar(aulaId, blocoId, requireProfessorId(user), dto);
  }

  @Post("publicar")
  async publicar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
    @LegacyToken() token: string | undefined,
  ): Promise<BlocoDto> {
    return this.enquete.publicar(
      aulaId,
      blocoId,
      requireProfessorId(user),
      requireToken(token),
    );
  }

  @Post("iniciar")
  async iniciar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
    @LegacyToken() token: string | undefined,
  ): Promise<BlocoDto> {
    return this.enquete.iniciar(
      aulaId,
      blocoId,
      requireProfessorId(user),
      requireToken(token),
    );
  }
}
