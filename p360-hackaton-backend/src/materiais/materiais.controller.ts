import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

import { Public } from "../auth/public.decorator";
import { LegacyUser } from "../auth/legacy-user.decorator";
import { legacyUsuarioId, requireProfessorId } from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { MateriaisService } from "./materiais.service";
import type { Apresentacao } from "./schemas";

class RespostaSimuladoItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  questaoIndex!: number;

  /** `null` = deixou em branco. */
  @IsOptional()
  @IsString()
  alternativaLabel?: string | null;
}

class ResponderSimuladoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RespostaSimuladoItemDto)
  respostas!: RespostaSimuladoItemDto[];

  /** Identidade anônima gerada/persistida no navegador do aluno (sem login). */
  @IsOptional()
  @IsString()
  alunoToken?: string;
}

class PublicarDto {
  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}

class GabaritoDto {
  @IsOptional()
  @IsBoolean()
  liberado?: boolean;
}

/** Nome do usuário legado, para exibir na lista de tentativas. */
function nomeDoUsuario(user: LegacyTokenInfo | undefined): string | undefined {
  if (typeof user?.user !== "object" || user.user === null) return undefined;
  const nome = (user.user as Record<string, unknown>).nome;
  return typeof nome === "string" ? nome : undefined;
}

/** Geração e download dos materiais — ações do professor. */
@Controller("aulas/:aulaId/blocos/:blocoId/materiais")
export class MateriaisController {
  constructor(private readonly materiais: MateriaisService) {}

  /**
   * Gera o material do bloco. Sem prompt: o contexto vem da aula e dos blocos
   * anteriores; `bloco.config` traz apenas as personalizações opcionais.
   */
  @Post("gerar")
  async gerar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.materiais.gerar(aulaId, blocoId, requireProfessorId(user));
  }

  /** Renderiza o arquivo na hora, a partir da estrutura salva. */
  @Get("download")
  async download(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const arquivo = await this.materiais.baixar(
      aulaId,
      blocoId,
      requireProfessorId(user),
    );

    res.setHeader("Content-Type", arquivo.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${arquivo.filename}"`,
    );
    res.setHeader("Content-Length", String(arquivo.buffer.length));
    res.end(arquivo.buffer);
  }

  /** Panorama das tentativas do simulado. */
  @Get("simulado/resultados")
  async resultados(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ) {
    return this.materiais.resultadosDoSimulado(
      aulaId,
      blocoId,
      requireProfessorId(user),
    );
  }

  /**
   * Disponibiliza o material de pós-aula para a turma (ou recolhe).
   * É o equivalente ao "liberar" da sessão, mas para fazer em casa.
   */
  @Post("publicar")
  async publicar(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: PublicarDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.materiais.publicarPosAula(
      aulaId,
      blocoId,
      requireProfessorId(user),
      dto.publicado ?? true,
    );
  }

  /** Libera (ou oculta) o gabarito comentado do simulado. */
  @Post("simulado/gabarito")
  async gabarito(
    @Param("aulaId") aulaId: string,
    @Param("blocoId") blocoId: string,
    @Body() dto: GabaritoDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<BlocoDto> {
    return this.materiais.definirGabarito(
      aulaId,
      blocoId,
      requireProfessorId(user),
      dto.liberado ?? true,
    );
  }
}

/**
 * Simulado do aluno — **página própria**, fora da sessão ao vivo.
 *
 * Pós-aula é para fazer em casa, então o acesso não depende de a sessão estar
 * acontecendo: o gate é a publicação pelo professor, não login. Um aluno
 * deslogado é identificado por um `alunoToken` gerado e persistido no próprio
 * navegador (a mesma ideia do `anonId` da sala) — é o que vira `usuarioId` na
 * tentativa salva, o suficiente pra métrica de desempenho e pra impedir
 * refazer o simulado num F5. Quem estiver logado usa a identidade real (some
 * o hand-off precisa dela).
 */
@Controller("simulados/:blocoId")
export class SimuladoAlunoController {
  constructor(private readonly materiais: MateriaisService) {}

  @Public()
  @Get()
  async obter(
    @Param("blocoId") blocoId: string,
    @Query("alunoToken") alunoToken: string | undefined,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ) {
    return this.materiais.simuladoPorBloco(
      blocoId,
      resolveAlunoId(user, alunoToken),
    );
  }

  @Public()
  @Post("responder")
  async responder(
    @Param("blocoId") blocoId: string,
    @Body() dto: ResponderSimuladoDto,
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ) {
    return this.materiais.responderSimulado(
      blocoId,
      resolveAlunoId(user, dto.alunoToken),
      nomeDoUsuario(user),
      dto.respostas.map((r) => ({
        questaoIndex: r.questaoIndex,
        alternativaLabel: r.alternativaLabel ?? null,
      })),
    );
  }
}

/**
 * Materiais na sala do aluno. Só respondem quando o professor liberou o bloco.
 * Slides têm **navegação livre**: o aluno anda no próprio ritmo.
 *
 * Sobre autenticação: a sala admite aluno **anônimo** (o mesmo motivo que torna
 * `/sessoes/:codigo/estado` público). Por isso os slides são `@Public()` — o gate
 * é a liberação do bloco pelo professor, não a identidade. O simulado, ao
 * contrário, registra tentativa por aluno e exige login.
 */
@Controller("sessoes/:sessaoId/blocos/:blocoId/materiais")
export class MateriaisAlunoController {
  constructor(private readonly materiais: MateriaisService) {}

  @Public()
  @Get("slides")
  async slides(
    @Param("sessaoId") sessaoId: string,
    @Param("blocoId") blocoId: string,
  ): Promise<Apresentacao> {
    return this.materiais.slidesParaAluno(sessaoId, blocoId);
  }

  // O simulado NÃO fica aqui: é pós-aula e tem página própria
  // (`SimuladoAlunoController`), acessível fora da sessão ao vivo.
}

/**
 * Download de resumo/material complementar para a turma — gate é a
 * publicação pelo professor (`publicadoEm`), não a sessão ao vivo nem login:
 * o aluno pode abrir isso depois da aula, de qualquer dispositivo.
 */
@Controller("materiais-publicos/:blocoId")
export class MateriaisPublicosController {
  constructor(private readonly materiais: MateriaisService) {}

  @Public()
  @Get("download")
  async download(
    @Param("blocoId") blocoId: string,
    @Res() res: Response,
  ): Promise<void> {
    const arquivo = await this.materiais.baixarPublico(blocoId);

    res.setHeader("Content-Type", arquivo.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${arquivo.filename}"`,
    );
    res.setHeader("Content-Length", String(arquivo.buffer.length));
    res.end(arquivo.buffer);
  }
}

/** O simulado registra tentativa por aluno — exige identidade real. */
/**
 * Identidade real (logado) tem prioridade; sem ela, cai pro token anônimo do
 * navegador. Prefixado pra nunca colidir com um id numérico legado real.
 */
function resolveAlunoId(
  user: LegacyTokenInfo | undefined,
  alunoToken: string | undefined,
): string {
  const id = legacyUsuarioId(user);
  if (id !== undefined) return String(id);

  const token = alunoToken?.trim();
  if (!token) {
    throw new BadRequestException(
      "Token do aluno não informado — recarregue a página.",
    );
  }
  return `anon:${token}`;
}
