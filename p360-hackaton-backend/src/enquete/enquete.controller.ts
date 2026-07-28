import {
  Body,
  Controller,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";

import { LegacyToken } from "../auth/legacy-token.decorator";
import { LegacyUser } from "../auth/legacy-user.decorator";
import { legacyEmpId, requireProfessorId } from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { EnqueteService } from "./enquete.service";
import {
  GerarEnqueteDto,
  IniciarEnqueteDto,
  RegistrarResultadoEnqueteDto,
  TrocarQuestaoDto,
} from "./dto/enquete.dto";

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
      legacyEmpId(user),
    );
  }

  /**
   * Sobe uma questão ao vivo. Sem `indice`, a primeira; com `indice`, é o
   * "próxima questão" da tela de apresentação — o PIN da turma não muda.
   */
  @Post("iniciar")
  async iniciar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: IniciarEnqueteDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
    @LegacyToken() token: string | undefined,
  ): Promise<BlocoDto> {
    return this.enquete.iniciar(
      aulaId,
      blocoId,
      requireProfessorId(user),
      requireToken(token),
      dto.indice ?? 0,
    );
  }

  /**
   * Só registra em qual questão a sala está agora — quem de fato troca a
   * questão ao vivo pra turma é a tela de apresentação, direto no WebSocket
   * do poll360 (`poll:end`/`poll:restart`, ver `useEnqueteLive`). Chamar
   * `iniciar` de novo aqui reabriria (e derrubaria) a sessão sem avisar
   * ninguém.
   */
  @Post("questao-atual")
  async trocarQuestao(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: TrocarQuestaoDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.enquete.avancar(
      aulaId,
      blocoId,
      requireProfessorId(user),
      dto.indice,
    );
  }

  /**
   * Registra o resultado agregado de uma questão encerrada — chamado pela
   * tela de apresentação assim que recebe `poll:ended` do poll360. Base das
   * métricas de "essa pergunta a turma erra muito".
   */
  @Post("resultado")
  async registrarResultado(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: RegistrarResultadoEnqueteDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<void> {
    return this.enquete.registrarResultado(
      aulaId,
      blocoId,
      requireProfessorId(user),
      dto,
    );
  }
}
