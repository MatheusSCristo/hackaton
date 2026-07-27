import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  Aula,
  AulaBloco,
  AulaMaterial,
  AulaMetrica,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CasosService } from "../casos/casos.service";
import { toBlocoDto } from "./blocos.service";
import type { CreateAulaDto } from "./dto/create-aula.dto";
import type {
  AulaDto,
  OverviewDto,
  OverviewKpis,
} from "./dto/aula-response.dto";

type AulaComRelacoes = Aula & {
  materiais: AulaMaterial[];
  metrica: AulaMetrica | null;
  blocos: AulaBloco[];
};

function engajamentoPct(m: AulaMetrica): number {
  return m.alunosTotal
    ? Math.round((100 * m.alunosEngajados) / m.alunosTotal)
    : 0;
}

function toDto(aula: AulaComRelacoes, casoImagem: string | null = null): AulaDto {
  return {
    id: aula.id,
    titulo: aula.titulo,
    modo: aula.modo,
    casoLegacyId: aula.casoLegacyId,
    casoTitulo: aula.casoTitulo,
    casoImagem,
    tema: aula.tema,
    publico: aula.publico,
    duracao: aula.duracao,
    formato: aula.formato,
    createdAt: aula.createdAt.toISOString(),
    materiais: aula.materiais.map((m) => m.tipo),
    blocos: [...aula.blocos].sort((a, b) => a.ordem - b.ordem).map(toBlocoDto),
    metrica: aula.metrica
      ? {
          alunosTotal: aula.metrica.alunosTotal,
          alunosEngajados: aula.metrica.alunosEngajados,
          mediaAcertos: aula.metrica.mediaAcertos,
          taxaConclusao: aula.metrica.taxaConclusao,
          engajamento: engajamentoPct(aula.metrica),
        }
      : null,
  };
}

const avg = (nums: number[]): number =>
  nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;

@Injectable()
export class AulasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casos: CasosService,
  ) {}

  async create(
    professorId: string,
    empId: number | undefined,
    dto: CreateAulaDto,
  ): Promise<AulaDto> {
    const titulo =
      dto.casoTitulo?.trim() || dto.tema?.trim() || "Aula sem título";

    const aula = await this.prisma.aula.create({
      data: {
        professorId,
        empId: empId ?? null,
        titulo,
        modo: dto.modo,
        casoLegacyId: dto.casoLegacyId ?? null,
        casoTitulo: dto.casoTitulo ?? null,
        tema: dto.tema ?? null,
        publico: dto.publico ?? null,
        duracao: dto.duracao ?? null,
        formato: dto.formato ?? null,
        objetivos: dto.objetivos ?? null,
        materiais: {
          create: (dto.materiais ?? []).map((tipo) => ({ tipo })),
        },
        // A ordem enviada pelo professor é a verdade; `ordem` explícita no DTO
        // ganha do índice do array.
        blocos: {
          create: (dto.blocos ?? []).map((bloco, index) => ({
            tipo: bloco.tipo,
            origem: bloco.origem ?? "manual",
            ordem: bloco.ordem ?? index,
            config: (bloco.config ?? {}) as Prisma.InputJsonValue,
          })),
        },
        // Sem métrica na criação: ela só existe quando há execução real de um
        // bloco de caso. Número inventado ao lado de dado real mina a confiança
        // no dashboard — a UI mostra "sem dados ainda".
      },
      include: { materiais: true, metrica: true, blocos: true },
    });

    return toDto(aula);
  }

  async listByProfessor(professorId: string): Promise<AulaComRelacoes[]> {
    return this.prisma.aula.findMany({
      where: { professorId },
      include: { materiais: true, metrica: true, blocos: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Remove a aula e tudo que depende dela (blocos, materiais, sessões — cascade no schema). */
  async remove(professorId: string, aulaId: string): Promise<void> {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, professorId },
      select: { id: true },
    });
    if (!aula) {
      throw new NotFoundException("Aula não encontrada.");
    }
    await this.prisma.aula.delete({ where: { id: aulaId } });
  }

  /** Uma aula do professor (para o cockpit da sessão). */
  async findOne(professorId: string, aulaId: string): Promise<AulaDto> {
    const aula = await this.prisma.aula.findFirst({
      where: { id: aulaId, professorId },
      include: { materiais: true, metrica: true, blocos: true },
    });
    if (!aula) {
      throw new NotFoundException("Aula não encontrada.");
    }
    const imagem = aula.casoLegacyId
      ? (await this.casos.imagensPorId([aula.casoLegacyId])).get(
          aula.casoLegacyId,
        ) ?? null
      : null;
    return toDto(aula, imagem);
  }

  async overview(professorId: string): Promise<OverviewDto> {
    const aulas = await this.listByProfessor(professorId);
    const metricas = aulas
      .map((a) => a.metrica)
      .filter((m): m is AulaMetrica => m !== null);

    const kpis: OverviewKpis = {
      totalAulas: aulas.length,
      alunosImpactados: metricas.reduce((s, m) => s + m.alunosTotal, 0),
      mediaAcertos: avg(metricas.map((m) => m.mediaAcertos)),
      engajamento: avg(metricas.map(engajamentoPct)),
    };

    // Uma única consulta em lote pro banco legado, em vez de N+1 por aula.
    const casoIds = [
      ...new Set(
        aulas
          .map((a) => a.casoLegacyId)
          .filter((id): id is number => id !== null),
      ),
    ];
    const imagens = await this.casos.imagensPorId(casoIds);

    return {
      kpis,
      aulas: aulas.map((a) =>
        toDto(a, a.casoLegacyId ? (imagens.get(a.casoLegacyId) ?? null) : null),
      ),
    };
  }
}
