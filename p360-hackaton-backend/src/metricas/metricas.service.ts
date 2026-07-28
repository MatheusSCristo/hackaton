import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function avg(nums: number[]): number {
  return nums.length
    ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length)
    : 0;
}

export interface MetricasKpis {
  totalAulas: number;
  /** Alunos únicos que responderam algo (simulado logado + enquete não dá pra saber quem). */
  alunosImpactados: number;
  /** Média de acerto combinando simulado e enquete. */
  mediaAcertos: number;
  /** % das aulas com pelo menos uma resposta registrada (simulado ou enquete). */
  engajamento: number;
}

export interface QuestaoDificil {
  aulaId: string;
  aulaTitulo: string;
  blocoId: string;
  tipo: "simulado" | "enquete";
  enunciado: string;
  respostas: number;
  pctAcerto: number;
}

export interface DesempenhoAluno {
  usuarioId: string;
  nome: string | null;
  tentativas: number;
  mediaAcertos: number;
}

export interface DesempenhoPorAula {
  aulaId: string;
  aulaTitulo: string;
  tentativasSimulado: number;
  mediaSimulado: number | null;
  questoesEnquete: number;
  mediaEnquete: number | null;
}

export interface MetricasDetalhadas {
  kpis: MetricasKpis;
  questoesMaisDificeis: QuestaoDificil[];
  desempenhoPorAluno: DesempenhoAluno[];
  porAula: DesempenhoPorAula[];
}

/**
 * Métricas reais de aprendizagem — simulado e enquete, os dois lugares onde
 * um aluno "responde" alguma coisa hoje. Deliberadamente NÃO usa
 * `AulaMetrica`/caso clínico: esse fluxo está instável e misturado ali
 * gerava os números "muito errados" no Overview.
 */
@Injectable()
export class MetricasService {
  constructor(private readonly prisma: PrismaService) {}

  private async aulaIdsDoProfessor(professorId: string): Promise<string[]> {
    const aulas = await this.prisma.aula.findMany({
      where: { professorId },
      select: { id: true },
    });
    return aulas.map((a) => a.id);
  }

  async kpis(professorId: string): Promise<MetricasKpis> {
    const aulaIds = await this.aulaIdsDoProfessor(professorId);
    if (aulaIds.length === 0) {
      return { totalAulas: 0, alunosImpactados: 0, mediaAcertos: 0, engajamento: 0 };
    }

    const [tentativas, resultadosEnquete] = await Promise.all([
      this.prisma.simuladoTentativa.findMany({
        where: { bloco: { aulaId: { in: aulaIds } } },
        select: { usuarioId: true, percentual: true, blocoId: true },
      }),
      this.prisma.enqueteResultado.findMany({
        where: { bloco: { aulaId: { in: aulaIds } } },
        select: { pctAcerto: true, totalVotos: true, blocoId: true },
      }),
    ]);

    const blocosComResposta = new Set<string>();
    const aulaPorBloco = await this.mapaAulaPorBloco([
      ...tentativas.map((t) => t.blocoId),
      ...resultadosEnquete.map((r) => r.blocoId),
    ]);
    for (const t of tentativas) blocosComResposta.add(aulaPorBloco.get(t.blocoId) ?? "");
    for (const r of resultadosEnquete) {
      if (r.totalVotos > 0) blocosComResposta.add(aulaPorBloco.get(r.blocoId) ?? "");
    }
    blocosComResposta.delete("");

    const alunosUnicos = new Set(tentativas.map((t) => t.usuarioId));
    const medias = [
      ...tentativas.map((t) => t.percentual),
      ...resultadosEnquete.filter((r) => r.totalVotos > 0).map((r) => r.pctAcerto),
    ];

    return {
      totalAulas: aulaIds.length,
      alunosImpactados: alunosUnicos.size,
      mediaAcertos: avg(medias),
      engajamento: Math.round((100 * blocosComResposta.size) / aulaIds.length),
    };
  }

  async detalhado(professorId: string): Promise<MetricasDetalhadas> {
    const aulaIds = await this.aulaIdsDoProfessor(professorId);
    const kpis = await this.kpis(professorId);

    if (aulaIds.length === 0) {
      return { kpis, questoesMaisDificeis: [], desempenhoPorAluno: [], porAula: [] };
    }

    const [blocosSimulado, blocosEnquete, tentativas, resultadosEnquete] =
      await Promise.all([
        this.prisma.aulaBloco.findMany({
          where: { aulaId: { in: aulaIds }, tipo: "simulado" },
          select: {
            id: true,
            aulaId: true,
            output: true,
            aula: { select: { titulo: true } },
          },
        }),
        this.prisma.aulaBloco.findMany({
          where: { aulaId: { in: aulaIds }, tipo: "enquete" },
          select: { id: true, aulaId: true, aula: { select: { titulo: true } } },
        }),
        this.prisma.simuladoTentativa.findMany({
          where: { bloco: { aulaId: { in: aulaIds } } },
        }),
        this.prisma.enqueteResultado.findMany({
          where: { bloco: { aulaId: { in: aulaIds } } },
        }),
      ]);

    const tituloPorAula = new Map<string, string>();
    for (const b of blocosSimulado) tituloPorAula.set(b.aulaId, b.aula.titulo);
    for (const b of blocosEnquete) tituloPorAula.set(b.aulaId, b.aula.titulo);

    // ---- Questões de simulado mais difíceis (agrega por questaoIndex, cruzando tentativas) ----
    const questoesSimulado: QuestaoDificil[] = [];
    for (const bloco of blocosSimulado) {
      const output = asObject(bloco.output) ?? {};
      const simulado = asObject(output.simulado);
      const perguntas = Array.isArray(simulado?.questions) ? simulado!.questions : [];
      const tentativasDoBloco = tentativas.filter((t) => t.blocoId === bloco.id);
      if (tentativasDoBloco.length === 0) continue;

      const porQuestao = new Map<number, { acertos: number; total: number }>();
      for (const t of tentativasDoBloco) {
        const respostas = Array.isArray(t.respostas) ? t.respostas : [];
        for (const r of respostas as { questaoIndex?: number; acertou?: boolean }[]) {
          if (typeof r.questaoIndex !== "number") continue;
          const atual = porQuestao.get(r.questaoIndex) ?? { acertos: 0, total: 0 };
          atual.total += 1;
          if (r.acertou) atual.acertos += 1;
          porQuestao.set(r.questaoIndex, atual);
        }
      }

      for (const [questaoIndex, { acertos, total }] of porQuestao) {
        const pergunta = asObject(perguntas[questaoIndex]);
        const statement =
          typeof pergunta?.statement === "string" ? pergunta.statement : `Questão ${questaoIndex + 1}`;
        questoesSimulado.push({
          aulaId: bloco.aulaId,
          aulaTitulo: bloco.aula.titulo,
          blocoId: bloco.id,
          tipo: "simulado",
          enunciado: statement,
          respostas: total,
          pctAcerto: total > 0 ? Math.round((100 * acertos) / total) : 0,
        });
      }
    }

    // ---- Questões de enquete mais difíceis (já vêm agregadas) ----
    const questoesEnquete: QuestaoDificil[] = resultadosEnquete
      .filter((r) => r.totalVotos > 0)
      .map((r) => ({
        aulaId: blocosEnquete.find((b) => b.id === r.blocoId)?.aulaId ?? "",
        aulaTitulo: blocosEnquete.find((b) => b.id === r.blocoId)?.aula.titulo ?? "",
        blocoId: r.blocoId,
        tipo: "enquete" as const,
        enunciado: r.enunciado,
        respostas: r.totalVotos,
        pctAcerto: r.pctAcerto,
      }));

    const questoesMaisDificeis = [...questoesSimulado, ...questoesEnquete]
      .sort((a, b) => a.pctAcerto - b.pctAcerto)
      .slice(0, 15);

    // ---- Desempenho por aluno (só simulado — enquete não identifica quem votou) ----
    const porAluno = new Map<string, { nome: string | null; total: number; soma: number }>();
    for (const t of tentativas) {
      const atual = porAluno.get(t.usuarioId) ?? { nome: t.nome, total: 0, soma: 0 };
      atual.total += 1;
      atual.soma += t.percentual;
      if (t.nome) atual.nome = t.nome;
      porAluno.set(t.usuarioId, atual);
    }
    const desempenhoPorAluno: DesempenhoAluno[] = [...porAluno.entries()]
      .map(([usuarioId, v]) => ({
        usuarioId,
        nome: v.nome,
        tentativas: v.total,
        mediaAcertos: Math.round(v.soma / v.total),
      }))
      .sort((a, b) => a.mediaAcertos - b.mediaAcertos);

    // ---- Desempenho por aula (visão consolidada) ----
    const porAula: DesempenhoPorAula[] = [...tituloPorAula.entries()].map(
      ([aulaId, aulaTitulo]) => {
        const tentativasDaAula = tentativas.filter(
          (t) => blocosSimulado.find((b) => b.id === t.blocoId)?.aulaId === aulaId,
        );
        const resultadosDaAula = resultadosEnquete.filter(
          (r) =>
            blocosEnquete.find((b) => b.id === r.blocoId)?.aulaId === aulaId &&
            r.totalVotos > 0,
        );
        return {
          aulaId,
          aulaTitulo,
          tentativasSimulado: tentativasDaAula.length,
          mediaSimulado:
            tentativasDaAula.length > 0
              ? avg(tentativasDaAula.map((t) => t.percentual))
              : null,
          questoesEnquete: resultadosDaAula.length,
          mediaEnquete:
            resultadosDaAula.length > 0
              ? avg(resultadosDaAula.map((r) => r.pctAcerto))
              : null,
        };
      },
    );

    return { kpis, questoesMaisDificeis, desempenhoPorAluno, porAula };
  }

  /** blocoId -> aulaId, pra não repetir a mesma query em vários lugares. */
  private async mapaAulaPorBloco(blocoIds: string[]): Promise<Map<string, string>> {
    if (blocoIds.length === 0) return new Map();
    const blocos = await this.prisma.aulaBloco.findMany({
      where: { id: { in: [...new Set(blocoIds)] } },
      select: { id: true, aulaId: true },
    });
    return new Map(blocos.map((b) => [b.id, b.aulaId]));
  }
}
