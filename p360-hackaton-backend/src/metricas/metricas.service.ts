import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { Poll360DbService } from "../enquete/poll360-db.service";

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
  email: string | null;
  tentativas: number;
  mediaAcertos: number;
}

/** Mesma ideia de `DesempenhoAluno`, mas identificado por e-mail (é o que o
 * poll360 coleta do respondente) em vez de `usuarioId` do legado. */
export interface DesempenhoAlunoEnquete {
  email: string;
  nome: string | null;
  respostas: number;
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

export interface FaixaDistribuicao {
  faixa: string;
  minimo: number;
  quantidade: number;
}

export interface InsightMetrica {
  tipo: "critico" | "atencao" | "positivo" | "info";
  titulo: string;
  texto: string;
}

export interface MetricasDetalhadas {
  kpis: MetricasKpis;
  insights: InsightMetrica[];
  distribuicaoAcertos: FaixaDistribuicao[];
  questoesMaisDificeis: QuestaoDificil[];
  desempenhoPorAluno: DesempenhoAluno[];
  desempenhoPorAlunoEnquete: DesempenhoAlunoEnquete[];
  porAula: DesempenhoPorAula[];
}

const FAIXAS = [
  { faixa: "0–25%", minimo: 0, max: 25 },
  { faixa: "25–50%", minimo: 25, max: 50 },
  { faixa: "50–75%", minimo: 50, max: 75 },
  { faixa: "75–100%", minimo: 75, max: 101 },
];

/**
 * Métricas reais de aprendizagem — simulado e enquete, os dois lugares onde
 * um aluno "responde" alguma coisa hoje. Deliberadamente NÃO usa
 * `AulaMetrica`/caso clínico: esse fluxo está instável e misturado ali
 * gerava os números "muito errados" no Overview.
 */
@Injectable()
export class MetricasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly poll360Db: Poll360DbService,
  ) {}

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
      return {
        kpis,
        insights: [],
        distribuicaoAcertos: [],
        questoesMaisDificeis: [],
        desempenhoPorAluno: [],
        desempenhoPorAlunoEnquete: [],
        porAula: [],
      };
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
          select: {
            id: true,
            aulaId: true,
            output: true,
            aula: { select: { titulo: true } },
          },
        }),
        this.prisma.simuladoTentativa.findMany({
          where: { bloco: { aulaId: { in: aulaIds } } },
        }),
        this.prisma.enqueteResultado.findMany({
          where: { bloco: { aulaId: { in: aulaIds } } },
        }),
      ]);

    // ---- Desempenho por aluno na enquete (lido direto do poll360 — é ele
    // quem sabe quem votou o quê; aqui só guardamos o agregado por opção) ----
    const pacotesEnquete = blocosEnquete
      .map((b) => {
        const output = asObject(b.output) ?? {};
        const packageId = output.poll360PackageId;
        return typeof packageId === "string" && packageId
          ? {
              packageId,
              nomeCampoId:
                typeof output.poll360NomeCampoId === "string"
                  ? output.poll360NomeCampoId
                  : null,
            }
          : null;
      })
      .filter((p): p is { packageId: string; nomeCampoId: string | null } => p !== null);
    const desempenhoPorAlunoEnquete: DesempenhoAlunoEnquete[] = (
      await this.poll360Db.desempenhoPorAluno(pacotesEnquete)
    )
      .filter((a) => a.total > 0)
      .map((a) => ({
        email: a.email,
        nome: a.nome,
        respostas: a.total,
        mediaAcertos: Math.round((100 * a.acertos) / a.total),
      }))
      .sort((a, b) => a.mediaAcertos - b.mediaAcertos);

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
      .slice(0, 5);

    // ---- Desempenho por aluno (só simulado — enquete não identifica quem votou) ----
    const porAluno = new Map<
      string,
      { nome: string | null; email: string | null; total: number; soma: number }
    >();
    for (const t of tentativas) {
      const atual =
        porAluno.get(t.usuarioId) ?? { nome: t.nome, email: t.email, total: 0, soma: 0 };
      atual.total += 1;
      atual.soma += t.percentual;
      if (t.nome) atual.nome = t.nome;
      if (t.email) atual.email = t.email;
      porAluno.set(t.usuarioId, atual);
    }
    const desempenhoPorAluno: DesempenhoAluno[] = [...porAluno.entries()]
      .map(([usuarioId, v]) => ({
        usuarioId,
        nome: v.nome,
        email: v.email,
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

    // ---- Distribuição de desempenho (simulado — é o que tem tentativa individual) ----
    const distribuicaoAcertos: FaixaDistribuicao[] = FAIXAS.map(
      ({ faixa, minimo, max }) => ({
        faixa,
        minimo,
        quantidade: tentativas.filter((t) => t.percentual >= minimo && t.percentual < max)
          .length,
      }),
    );

    const insights = this.gerarInsights({
      kpis,
      questoesMaisDificeis,
      desempenhoPorAluno,
      porAula,
    });

    return {
      kpis,
      insights,
      distribuicaoAcertos,
      questoesMaisDificeis,
      desempenhoPorAluno,
      desempenhoPorAlunoEnquete,
      porAula,
    };
  }

  /**
   * Destaques computados na hora (sem LLM — é aritmética sobre o que já
   * temos, mais rápido e determinístico que pedir pra uma IA "olhar" os
   * mesmos números).
   */
  private gerarInsights(dados: {
    kpis: MetricasKpis;
    questoesMaisDificeis: QuestaoDificil[];
    desempenhoPorAluno: DesempenhoAluno[];
    porAula: DesempenhoPorAula[];
  }): InsightMetrica[] {
    const insights: InsightMetrica[] = [];
    const { kpis, questoesMaisDificeis, desempenhoPorAluno, porAula } = dados;

    if (kpis.mediaAcertos > 0) {
      if (kpis.mediaAcertos < 50) {
        insights.push({
          tipo: "critico",
          titulo: "Média geral baixa",
          texto: `A média geral de acerto está em ${kpis.mediaAcertos}% — bem abaixo do ideal (70%). Vale revisar os fundamentos antes de avançar.`,
        });
      } else if (kpis.mediaAcertos >= 70) {
        insights.push({
          tipo: "positivo",
          titulo: "Turma indo bem",
          texto: `A turma está com uma boa média geral de acerto (${kpis.mediaAcertos}%).`,
        });
      }
    }

    const piorQuestao = questoesMaisDificeis[0];
    if (piorQuestao && piorQuestao.pctAcerto < 50) {
      const enunciadoCurto =
        piorQuestao.enunciado.length > 90
          ? `${piorQuestao.enunciado.slice(0, 90)}…`
          : piorQuestao.enunciado;
      insights.push({
        tipo: "critico",
        titulo: "Questão mais difícil",
        texto: `A questão "${enunciadoCurto}" (${piorQuestao.aulaTitulo}) teve só ${piorQuestao.pctAcerto}% de acerto — o maior sinal de dificuldade que a turma mostrou.`,
      });
    }

    const comDados = desempenhoPorAluno.filter((a) => a.tentativas > 0);
    if (comDados.length > 0) {
      const abaixoDe50 = comDados.filter((a) => a.mediaAcertos < 50);
      if (abaixoDe50.length > 0) {
        const pct = Math.round((100 * abaixoDe50.length) / comDados.length);
        insights.push({
          tipo: "atencao",
          titulo: "Alunos precisam de atenção",
          texto: `${abaixoDe50.length} de ${comDados.length} alunos (${pct}%) estão com média abaixo de 50% no simulado — podem precisar de atenção individual.`,
        });
      }
    }

    const aulasComAmbos = porAula.filter(
      (a) => a.mediaSimulado !== null && a.mediaEnquete !== null,
    );
    if (aulasComAmbos.length > 0) {
      const mediaSimulado = avg(
        aulasComAmbos.map((a) => a.mediaSimulado as number),
      );
      const mediaEnquete = avg(aulasComAmbos.map((a) => a.mediaEnquete as number));
      const diferenca = Math.abs(mediaSimulado - mediaEnquete);
      if (diferenca >= 15) {
        const melhor = mediaSimulado > mediaEnquete ? "simulado" : "enquete";
        const pior = mediaSimulado > mediaEnquete ? "enquete" : "simulado";
        insights.push({
          tipo: "info",
          titulo: "Simulado x enquete",
          texto: `A turma vai melhor em ${melhor} do que em ${pior} (${Math.max(mediaSimulado, mediaEnquete)}% vs ${Math.min(mediaSimulado, mediaEnquete)}%) — perguntas de múltipla escolha e ao vivo parecem medir coisas diferentes aqui.`,
        });
      }
    }

    if (kpis.engajamento > 0 && kpis.engajamento < 40) {
      insights.push({
        tipo: "atencao",
        titulo: "Poucas respostas registradas",
        texto: `Só ${kpis.engajamento}% das aulas têm alguma resposta registrada — considere disponibilizar simulado ou enquete com mais frequência para ter mais sinal sobre o aprendizado da turma.`,
      });
    }

    return insights;
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
