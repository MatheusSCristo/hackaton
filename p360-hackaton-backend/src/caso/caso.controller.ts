import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";

import { LegacyToken } from "../auth/legacy-token.decorator";
import { LegacyUser } from "../auth/legacy-user.decorator";
import {
  legacyEmpId,
  legacyUsuarioId,
  requireProfessorId,
} from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { SessaoGateway } from "../sessao/sessao.gateway";
import { SessaoService } from "../sessao/sessao.service";
import { CasoService } from "./caso.service";
import { CursoWrapperService } from "./curso-wrapper.service";
import type { TurmaLegacy } from "./curso-wrapper.service";

/** Ações do professor sobre o bloco `caso`. */
@Controller("aulas/:aulaId/blocos/:blocoId/caso")
export class CasoController {
  constructor(
    private readonly caso: CasoService,
    private readonly wrapper: CursoWrapperService,
    private readonly sessao: SessaoService,
    private readonly gateway: SessaoGateway,
  ) {}

  /** Publica o novo estado da sessão para a sala do aluno reagir. */
  private async avisarSala(sessaoId: string): Promise<void> {
    const estado = await this.sessao.estadoPorId(sessaoId);
    this.gateway.publicarEstado(estado.codigo, estado);
  }

  /** Cria/reusa o curso-wrapper e atribui à turma (deixa fechado). */
  @Post("preparar")
  async preparar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.caso.preparar(
      aulaId,
      blocoId,
      requireProfessorId(user),
      legacyEmpId(user),
      // Id real do usuário (o `id` do payload é o token) — vira `turmacurso.usu_id`.
      legacyUsuarioId(user),
    );
  }

  @Post("liberar/:sessaoId")
  async liberar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Param("sessaoId") sessaoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    const bloco = await this.caso.liberar(
      sessaoId,
      aulaId,
      blocoId,
      requireProfessorId(user),
    );
    await this.avisarSala(sessaoId);
    return bloco;
  }

  /** Fecha o acesso e já coleta o desempenho + diagnóstico. */
  @Post("encerrar/:sessaoId")
  async encerrar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Param("sessaoId") sessaoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    const bloco = await this.caso.encerrar(
      sessaoId,
      aulaId,
      blocoId,
      requireProfessorId(user),
    );
    await this.avisarSala(sessaoId);
    return bloco;
  }

  /** Recoleta sob demanda ("atualizar resultados"). */
  @Post("coletar")
  async coletar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.caso.coletar(aulaId, blocoId, requireProfessorId(user));
  }

  /** "X de Y concluíram" — informa a decisão de encerrar. */
  @Get("progresso")
  async progresso(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ) {
    return this.caso.progresso(aulaId, blocoId, requireProfessorId(user));
  }

  /** Turmas da empresa do professor (para configurar o bloco). */
  @Get("turmas")
  async turmas(
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<TurmaLegacy[]> {
    const empId = legacyEmpId(user);
    if (empId === undefined) {
      throw new BadRequestException("Empresa não identificada no token.");
    }
    return this.wrapper.listarTurmas(empId);
  }
}

/**
 * Acesso do aluno ao caso.
 *
 * Um passo só: `autorizar` valida a liberação, garante a matrícula e devolve a
 * URL do player legado, que o cliente abre em nova aba.
 *
 * Não existe endpoint de redirect aqui de propósito — `window.open` é navegação
 * do browser e **não** envia `X-Access-Token` (só XHR envia), então um redirect
 * intermediário nunca conseguiria autenticar o aluno.
 */
@Controller("sessoes/:sessaoId/blocos/:blocoId/caso")
export class CasoAlunoController {
  constructor(private readonly caso: CasoService) {}

  @Post("autorizar")
  async autorizar(
    @Param("sessaoId") sessaoId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
    @LegacyToken() token: string | undefined,
  ): Promise<{ url: string }> {
    const usuarioLegacyId = legacyUsuarioId(user);
    if (usuarioLegacyId === undefined || !token) {
      throw new UnauthorizedException(
        "Faça login no Paciente 360 para abrir o caso.",
      );
    }
    return this.caso.autorizarAluno({
      sessaoId,
      blocoId,
      usuarioLegacyId,
      tokenAluno: token,
    });
  }
}
