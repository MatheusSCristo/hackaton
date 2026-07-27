import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AulaBloco, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { findTemplate, momentoDoTipo } from "./bloco-tipos";
import type {
  ApplyTemplateDto,
  BlocoDto,
  CreateBlocoDto,
  ReorderBlocosDto,
  UpdateBlocoDto,
} from "./dto/bloco.dto";

type JsonObject = Record<string, unknown>;

function asObject(value: Prisma.JsonValue | null): JsonObject | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

export function toBlocoDto(bloco: AulaBloco): BlocoDto {
  return {
    id: bloco.id,
    ordem: bloco.ordem,
    tipo: bloco.tipo,
    origem: bloco.origem,
    momento: momentoDoTipo(bloco.tipo),
    config: asObject(bloco.config) ?? {},
    output: asObject(bloco.output),
  };
}

@Injectable()
export class BlocosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante que a aula pertence ao professor antes de qualquer operação de
   * bloco — evita que um professor manipule a sequência de outro.
   */
  private async assertAulaDoProfessor(
    aulaId: string,
    professorId: string,
  ): Promise<void> {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, professorId },
      select: { id: true },
    });
    if (!aula) {
      throw new NotFoundException("Aula não encontrada.");
    }
  }

  async list(aulaId: string, professorId: string): Promise<BlocoDto[]> {
    await this.assertAulaDoProfessor(aulaId, professorId);
    const blocos = await this.prisma.aulaBloco.findMany({
      where: { aulaId },
      orderBy: { ordem: "asc" },
    });
    return blocos.map(toBlocoDto);
  }

  async create(
    aulaId: string,
    professorId: string,
    dto: CreateBlocoDto,
  ): Promise<BlocoDto> {
    await this.assertAulaDoProfessor(aulaId, professorId);

    const ordem = dto.ordem ?? (await this.proximaOrdem(aulaId));
    const bloco = await this.prisma.aulaBloco.create({
      data: {
        aulaId,
        tipo: dto.tipo,
        origem: dto.origem ?? "manual",
        ordem,
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
    return toBlocoDto(bloco);
  }

  async update(
    aulaId: string,
    blocoId: string,
    professorId: string,
    dto: UpdateBlocoDto,
  ): Promise<BlocoDto> {
    await this.assertBloco(aulaId, blocoId, professorId);

    const data: Prisma.AulaBlocoUpdateInput = {};
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.config !== undefined) {
      data.config = dto.config as Prisma.InputJsonValue;
    }

    const bloco = await this.prisma.aulaBloco.update({
      where: { id: blocoId },
      data,
    });
    return toBlocoDto(bloco);
  }

  async remove(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<void> {
    await this.assertBloco(aulaId, blocoId, professorId);
    await this.prisma.aulaBloco.delete({ where: { id: blocoId } });
    await this.normalizarOrdem(aulaId);
  }

  /**
   * Reordena a sequência inteira. Exige a lista completa dos blocos da aula —
   * assim a ordem final é sempre densa (0..n-1) e sem ambiguidade.
   */
  async reorder(
    aulaId: string,
    professorId: string,
    dto: ReorderBlocosDto,
  ): Promise<BlocoDto[]> {
    await this.assertAulaDoProfessor(aulaId, professorId);

    const existentes = await this.prisma.aulaBloco.findMany({
      where: { aulaId },
      select: { id: true },
    });
    const idsAula = new Set(existentes.map((b) => b.id));
    const idsPedidos = new Set(dto.ordem);

    if (
      dto.ordem.length !== existentes.length ||
      idsPedidos.size !== dto.ordem.length ||
      dto.ordem.some((id) => !idsAula.has(id))
    ) {
      throw new BadRequestException(
        "A ordem deve conter exatamente uma vez cada bloco da aula.",
      );
    }

    await this.prisma.$transaction(
      dto.ordem.map((id, index) =>
        this.prisma.aulaBloco.update({
          where: { id },
          data: { ordem: index },
        }),
      ),
    );

    return this.list(aulaId, professorId);
  }

  /** Aplica um template: substitui a sequência atual pelos blocos-semente. */
  async applyTemplate(
    aulaId: string,
    professorId: string,
    dto: ApplyTemplateDto,
  ): Promise<BlocoDto[]> {
    await this.assertAulaDoProfessor(aulaId, professorId);

    const template = findTemplate(dto.templateId);
    if (!template) {
      throw new BadRequestException(
        `Template desconhecido: ${dto.templateId}.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.aulaBloco.deleteMany({ where: { aulaId } }),
      ...template.blocos.map((bloco, index) =>
        this.prisma.aulaBloco.create({
          data: {
            aulaId,
            tipo: bloco.tipo,
            origem: "template",
            ordem: index,
            config: (bloco.config ?? {}) as Prisma.InputJsonValue,
          },
        }),
      ),
    ]);

    return this.list(aulaId, professorId);
  }

  /** Carrega um bloco garantindo dono + pertencimento à aula. */
  async getBloco(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<AulaBloco> {
    return this.assertBloco(aulaId, blocoId, professorId);
  }

  /** Grava (merge) no `output` do bloco — usado por enquete/caso/diagnóstico. */
  async mergeOutput(blocoId: string, patch: JsonObject): Promise<BlocoDto> {
    const atual = await this.prisma.aulaBloco.findUnique({
      where: { id: blocoId },
      select: { output: true },
    });
    const output = { ...(asObject(atual?.output ?? null) ?? {}), ...patch };

    const bloco = await this.prisma.aulaBloco.update({
      where: { id: blocoId },
      data: { output: output as Prisma.InputJsonValue },
    });
    return toBlocoDto(bloco);
  }

  private async assertBloco(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<AulaBloco> {
    await this.assertAulaDoProfessor(aulaId, professorId);
    const bloco = await this.prisma.aulaBloco.findFirst({
      where: { id: blocoId, aulaId },
    });
    if (!bloco) {
      throw new NotFoundException("Bloco não encontrado nesta aula.");
    }
    return bloco;
  }

  private async proximaOrdem(aulaId: string): Promise<number> {
    const ultimo = await this.prisma.aulaBloco.findFirst({
      where: { aulaId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    return ultimo ? ultimo.ordem + 1 : 0;
  }

  /** Reindexa 0..n-1 depois de remoções, para não deixar buracos. */
  private async normalizarOrdem(aulaId: string): Promise<void> {
    const blocos = await this.prisma.aulaBloco.findMany({
      where: { aulaId },
      orderBy: { ordem: "asc" },
      select: { id: true, ordem: true },
    });
    const foraDeOrdem = blocos.filter((b, i) => b.ordem !== i);
    if (foraDeOrdem.length === 0) return;

    await this.prisma.$transaction(
      blocos.map((b, i) =>
        this.prisma.aulaBloco.update({
          where: { id: b.id },
          data: { ordem: i },
        }),
      ),
    );
  }
}
