import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { Public } from "../auth/public.decorator";
import { LegacyToken } from "../auth/legacy-token.decorator";
import { LegacyUser } from "../auth/legacy-user.decorator";
import { LegacyAuthService } from "../auth/legacy-auth.service";
import {
  legacyEmpId,
  legacyUsuarioId,
  requireProfessorId,
} from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import { SessaoGateway } from "./sessao.gateway";
import { SessaoService } from "./sessao.service";
import type { EstadoSessaoDto } from "./sessao.service";
import { EntrarSessaoDto } from "./dto/sessao.dto";

/**
 * Controle da sessão ao vivo.
 *
 * As ações do professor gravam o estado no banco **e depois** publicam no
 * socket — nessa ordem, para que quem reconectar leia a verdade já persistida.
 */
@Controller()
export class SessaoController {
  constructor(
    private readonly sessao: SessaoService,
    private readonly gateway: SessaoGateway,
    private readonly legacyAuth: LegacyAuthService,
  ) {}

  /** Abre (ou reaproveita) a sessão ao vivo da aula. */
  @Post("aulas/:aulaId/sessoes")
  async criar(
    @Param("aulaId") aulaId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto> {
    return this.sessao.criar(
      aulaId,
      requireProfessorId(user),
      legacyEmpId(user),
    );
  }

  /** Sessão viva da aula, se houver (cockpit reabrindo). */
  @Get("aulas/:aulaId/sessoes/atual")
  async atual(
    @Param("aulaId") aulaId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto | null> {
    return this.sessao.atual(aulaId, requireProfessorId(user));
  }

  /**
   * Estado por código — público: a sala do aluno precisa dele antes de qualquer
   * login (a enquete admite participante anônimo).
   */
  @Public()
  @Get("sessoes/:codigo/estado")
  async estado(@Param("codigo") codigo: string): Promise<EstadoSessaoDto> {
    return this.sessao.estadoPorCodigo(codigo);
  }

  /**
   * Entrada do aluno. É `@Public()` porque a enquete admite anônimo — mas, se
   * vier um `X-Access-Token`, validamos aqui para capturar a identidade (o bloco
   * de caso depende dela). Guard global não roda em rota pública, então a
   * resolução do token é explícita e tolerante a falha.
   */
  @Public()
  @Post("sessoes/:codigo/entrar")
  async entrar(
    @Param("codigo") codigo: string,
    @Body() dto: EntrarSessaoDto,
    @LegacyToken() token: string | undefined,
  ) {
    const usuario = token ? await this.resolverUsuario(token) : undefined;

    const usuarioId = legacyUsuarioId(usuario);
    const resultado = await this.sessao.entrar(codigo, {
      usuarioId: usuarioId !== undefined ? String(usuarioId) : undefined,
      nome: dto.nome,
      anonId: dto.anonId,
    });
    this.gateway.publicarEstado(codigo, resultado.estado);
    return resultado;
  }

  @Post("sessoes/:sessaoId/blocos/:blocoId/liberar")
  async liberar(
    @Param("sessaoId") sessaoId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto> {
    const estado = await this.sessao.liberarBloco(
      sessaoId,
      blocoId,
      requireProfessorId(user),
    );
    this.gateway.publicarEstado(estado.codigo, estado);
    return estado;
  }

  @Post("sessoes/:sessaoId/blocos/:blocoId/encerrar")
  async encerrarBloco(
    @Param("sessaoId") sessaoId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto> {
    const estado = await this.sessao.encerrarBloco(
      sessaoId,
      blocoId,
      requireProfessorId(user),
    );
    this.gateway.publicarEstado(estado.codigo, estado);
    return estado;
  }

  /** Confirma o início oficial — é o que o professor clica na tela de QR Code. */
  @Post("sessoes/:sessaoId/confirmar")
  async confirmar(
    @Param("sessaoId") sessaoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto> {
    const estado = await this.sessao.confirmarInicio(
      sessaoId,
      requireProfessorId(user),
    );
    this.gateway.publicarEstado(estado.codigo, estado);
    return estado;
  }

  /** Espelha o slide atual da apresentação para a turma conectada. */
  @Post("sessoes/:sessaoId/slide")
  async atualizarSlide(
    @Param("sessaoId") sessaoId: string,
    @Body() dto: { slideAtual: number },
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto> {
    const estado = await this.sessao.atualizarSlide(
      sessaoId,
      requireProfessorId(user),
      Number(dto.slideAtual) || 0,
    );
    this.gateway.publicarEstado(estado.codigo, estado);
    return estado;
  }

  @Post("sessoes/:sessaoId/encerrar")
  async encerrar(
    @Param("sessaoId") sessaoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<EstadoSessaoDto> {
    const estado = await this.sessao.encerrarSessao(
      sessaoId,
      requireProfessorId(user),
    );
    this.gateway.publicarEstado(estado.codigo, estado);
    return estado;
  }

  /** Token inválido não bloqueia a entrada: o aluno segue como anônimo. */
  private async resolverUsuario(
    token: string,
  ): Promise<LegacyTokenInfo | undefined> {
    try {
      return (await this.legacyAuth.validate(token)) ?? undefined;
    } catch {
      return undefined;
    }
  }
}
