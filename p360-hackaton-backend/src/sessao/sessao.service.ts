import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { randomInt } from "node:crypto";
import type { SessaoAula } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { toBlocoDto } from "../aulas/blocos.service";
import { ehPosAula } from "../aulas/bloco-tipos";
import type { BlocoDto } from "../aulas/dto/bloco.dto";

/** Estado que a sala do aluno e o cockpit consomem (snapshot completo). */
export interface EstadoSessaoDto {
  sessaoId: string;
  codigo: string;
  status: string;
  aulaTitulo: string;
  blocoAtual: BlocoDto | null;
  estadoAtual: string | null;
  /** Sequência inteira, para o cockpit. */
  blocos: BlocoDto[];
  participantes: number;
}

export interface EntrarResultado {
  participanteId: string;
  estado: EstadoSessaoDto;
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I/O/0/1
const TAMANHO_CODIGO = 6;

/** Sessão sem nenhuma atividade (bloco liberado, participante entrando) por
 * esse tempo é considerada abandonada — evita sala "ao vivo" pra sempre. */
const LIMITE_INATIVIDADE_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class SessaoService {
  private readonly logger = new Logger(SessaoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Varredura periódica: encerra sozinho qualquer sessão `aguardando`/`ativa`
   * sem atividade há mais de 3h — sem isso, uma sala esquecida aberta fica
   * "ao vivo" indefinidamente.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async fecharInativas(): Promise<void> {
    const limite = new Date(Date.now() - LIMITE_INATIVIDADE_MS);
    const { count } = await this.prisma.sessaoAula.updateMany({
      where: {
        status: { in: ["aguardando", "ativa"] },
        updatedAt: { lt: limite },
      },
      data: { status: "encerrada", endedAt: new Date(), estadoAtual: null },
    });
    if (count > 0) {
      this.logger.log(`${count} sessão(ões) encerrada(s) por inatividade.`);
    }
  }

  /** Cria (ou reaproveita) a sessão ao vivo de uma aula do professor. */
  async criar(
    aulaId: string,
    professorId: string,
    empId: number | undefined,
  ): Promise<EstadoSessaoDto> {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, professorId },
      select: { id: true },
    });
    if (!aula) throw new NotFoundException("Aula não encontrada.");

    // Uma sessão viva por aula: evita dois códigos concorrentes para a turma.
    const existente = await this.prisma.sessaoAula.findFirst({
      where: { aulaId, status: { in: ["aguardando", "ativa"] } },
    });
    if (existente) return this.estadoPorId(existente.id);

    const sessao = await this.prisma.sessaoAula.create({
      data: {
        aulaId,
        professorId,
        empId: empId ?? null,
        codigo: await this.gerarCodigoUnico(),
        status: "aguardando",
      },
    });
    return this.estadoPorId(sessao.id);
  }

  /** Sessão viva da aula (para o cockpit reabrir sem criar outra). */
  async atual(
    aulaId: string,
    professorId: string,
  ): Promise<EstadoSessaoDto | null> {
    const sessao = await this.prisma.sessaoAula.findFirst({
      where: {
        aulaId,
        professorId,
        status: { in: ["aguardando", "ativa"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!sessao) return null;

    // Checagem sob demanda, sem esperar a próxima varredura do cron: ao abrir
    // o cockpit de uma aula com sessão abandonada há mais de 3h, ela já deve
    // aparecer encerrada nesta mesma consulta.
    const inativaHaMuitoTempo =
      Date.now() - sessao.updatedAt.getTime() > LIMITE_INATIVIDADE_MS;
    if (inativaHaMuitoTempo) {
      await this.prisma.sessaoAula.update({
        where: { id: sessao.id },
        data: { status: "encerrada", endedAt: new Date(), estadoAtual: null },
      });
      return null;
    }

    return this.estadoPorId(sessao.id);
  }

  async estadoPorCodigo(codigo: string): Promise<EstadoSessaoDto> {
    const sessao = await this.buscarPorCodigo(codigo);
    return this.estadoPorId(sessao.id);
  }

  /**
   * Registra o participante na sala. Idempotente por (sessão, usuário) ou
   * (sessão, anonId) — reentrar depois de um F5 não duplica presença.
   */
  async entrar(
    codigo: string,
    dados: { usuarioId?: string; nome?: string; anonId?: string },
  ): Promise<EntrarResultado> {
    const sessao = await this.buscarPorCodigo(codigo);
    if (sessao.status === "encerrada") {
      throw new BadRequestException("Esta sessão já foi encerrada.");
    }

    const { usuarioId, anonId, nome } = dados;
    if (!usuarioId && !anonId) {
      throw new BadRequestException(
        "Informe a identificação do participante (login ou anonId).",
      );
    }

    const where = usuarioId
      ? { sessaoId_usuarioId: { sessaoId: sessao.id, usuarioId } }
      : { sessaoId_anonId: { sessaoId: sessao.id, anonId: anonId as string } };

    const participante = await this.prisma.sessaoParticipante.upsert({
      where,
      create: {
        sessaoId: sessao.id,
        usuarioId: usuarioId ?? null,
        anonId: usuarioId ? null : (anonId ?? null),
        nome: nome ?? null,
      },
      update: { nome: nome ?? undefined },
    });

    return {
      participanteId: participante.id,
      estado: await this.estadoPorId(sessao.id),
    };
  }

  /**
   * Libera um bloco para a turma. Idempotente: escreve o estado desejado em vez
   * de alternar — protege contra duplo-clique e retry de rede.
   */
  async liberarBloco(
    sessaoId: string,
    blocoId: string,
    professorId: string,
  ): Promise<EstadoSessaoDto> {
    const sessao = await this.assertSessaoDoProfessor(sessaoId, professorId);
    await this.assertBlocoDaAula(sessao.aulaId, blocoId);

    await this.prisma.sessaoAula.update({
      where: { id: sessaoId },
      data: {
        blocoAtualId: blocoId,
        estadoAtual: "liberado",
        status: "ativa",
        startedAt: sessao.startedAt ?? new Date(),
      },
    });
    return this.estadoPorId(sessaoId);
  }

  async encerrarBloco(
    sessaoId: string,
    blocoId: string,
    professorId: string,
  ): Promise<EstadoSessaoDto> {
    const sessao = await this.assertSessaoDoProfessor(sessaoId, professorId);
    await this.assertBlocoDaAula(sessao.aulaId, blocoId);

    await this.prisma.sessaoAula.update({
      where: { id: sessaoId },
      data: { blocoAtualId: blocoId, estadoAtual: "encerrado" },
    });
    return this.estadoPorId(sessaoId);
  }

  async encerrarSessao(
    sessaoId: string,
    professorId: string,
  ): Promise<EstadoSessaoDto> {
    await this.assertSessaoDoProfessor(sessaoId, professorId);
    await this.prisma.sessaoAula.update({
      where: { id: sessaoId },
      data: { status: "encerrada", endedAt: new Date(), estadoAtual: null },
    });
    return this.estadoPorId(sessaoId);
  }

  async estadoPorId(sessaoId: string): Promise<EstadoSessaoDto> {
    const sessao = await this.prisma.sessaoAula.findUnique({
      where: { id: sessaoId },
      include: {
        aula: { include: { blocos: { orderBy: { ordem: "asc" } } } },
        _count: { select: { participantes: true } },
      },
    });
    if (!sessao) throw new NotFoundException("Sessão não encontrada.");

    const blocos = sessao.aula.blocos.map(toBlocoDto);
    const blocoAtual =
      blocos.find((bloco) => bloco.id === sessao.blocoAtualId) ?? null;

    return {
      sessaoId: sessao.id,
      codigo: sessao.codigo,
      status: sessao.status,
      aulaTitulo: sessao.aula.titulo,
      blocoAtual,
      estadoAtual: sessao.estadoAtual,
      blocos,
      participantes: sessao._count.participantes,
    };
  }

  /** Usado pelo gate do bloco `caso`: o bloco está liberado agora? */
  async blocoEstaLiberado(sessaoId: string, blocoId: string): Promise<boolean> {
    const sessao = await this.prisma.sessaoAula.findUnique({
      where: { id: sessaoId },
      select: { status: true, blocoAtualId: true, estadoAtual: true },
    });
    return (
      sessao?.status === "ativa" &&
      sessao.blocoAtualId === blocoId &&
      sessao.estadoAtual === "liberado"
    );
  }

  private async buscarPorCodigo(codigo: string): Promise<SessaoAula> {
    const sessao = await this.prisma.sessaoAula.findUnique({
      where: { codigo: codigo.trim().toUpperCase() },
    });
    if (!sessao) throw new NotFoundException("Código de sessão inválido.");
    return sessao;
  }

  private async assertSessaoDoProfessor(
    sessaoId: string,
    professorId: string,
  ): Promise<SessaoAula> {
    const sessao = await this.prisma.sessaoAula.findFirst({
      where: { id: sessaoId, professorId },
    });
    if (!sessao) throw new NotFoundException("Sessão não encontrada.");
    return sessao;
  }

  private async assertBlocoDaAula(
    aulaId: string,
    blocoId: string,
  ): Promise<void> {
    const bloco = await this.prisma.aulaBloco.findFirst({
      where: { id: blocoId, aulaId },
      select: { id: true, tipo: true },
    });
    if (!bloco) {
      throw new NotFoundException("Bloco não encontrado nesta aula.");
    }
    // Pós-aula é para o aluno fazer em casa — não é conduzido ao vivo.
    if (ehPosAula(bloco.tipo)) {
      throw new BadRequestException(
        "Este material é de pós-aula: disponibilize para a turma em vez de liberar na sessão.",
      );
    }
  }

  private async gerarCodigoUnico(): Promise<string> {
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = Array.from(
        { length: TAMANHO_CODIGO },
        () => ALFABETO[randomInt(ALFABETO.length)],
      ).join("");
      const existe = await this.prisma.sessaoAula.findUnique({
        where: { codigo },
        select: { id: true },
      });
      if (!existe) return codigo;
    }
    throw new BadRequestException(
      "Não foi possível gerar um código de sessão. Tente novamente.",
    );
  }
}
