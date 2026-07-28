import { Injectable } from "@nestjs/common";
import type { Aula, AulaBloco, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { LegacyDbService } from "../legacy-db/legacy-db.service";

/**
 * Contexto de geração de material.
 *
 * A diferença central em relação ao projeto de origem: **o professor não escreve
 * um prompt**. Tudo aqui é derivado do que ele já escolheu na aula (caso do
 * acervo, tema, público, objetivos, formato) e do que os blocos anteriores
 * produziram (o diagnóstico do caso). `bloco.config` só carrega
 * **personalizações opcionais**.
 */
export interface ContextoAula {
  /** Tema principal, já resolvido (título do caso ou tema livre). */
  tema: string;
  casoTitulo: string | null;
  casoDescricao: string | null;
  area: string | null;
  temaClinico: string | null;
  publico: string | null;
  duracao: string | null;
  formato: string | null;
  objetivos: string | null;
  /** Pontos fracos vindos de blocos de caso ANTERIORES a este. */
  fraquezas: string[];
  /**
   * Slide pessoal do professor usado como base (texto extraído do `.pptx`).
   *
   * Quando existe, é a fonte mais forte do contexto: o professor já decidiu o
   * roteiro dele e a IA está ali para completar/adaptar, não para substituir.
   */
  slideBase: { nome: string; texto: string; nSlides: number | null } | null;
  /** Personalizações opcionais do bloco. */
  instrucoesExtras: string | null;
  nSlides: number | null;
  nQuestoes: number | null;
  idioma: string;
}

const DEFAULT_IDIOMA = "pt-BR";

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function slideBase(
  valor: unknown,
): { nome: string; texto: string; nSlides: number | null } | null {
  const obj = asObject(valor);
  const conteudo = texto(obj?.texto);
  if (!conteudo) return null;
  return {
    nome: texto(obj?.nome) ?? "apresentação do professor",
    texto: conteudo,
    nSlides: inteiro(obj?.nSlides),
  };
}

function inteiro(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

@Injectable()
export class ContextoAulaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly read: LegacyDbService,
  ) {}

  async montar(aula: Aula, bloco: AulaBloco): Promise<ContextoAula> {
    const config = asObject(bloco.config) ?? {};

    const caso = aula.casoLegacyId
      ? await this.dadosDoCaso(aula.casoLegacyId)
      : null;

    const tema =
      texto(aula.casoTitulo) ??
      texto(caso?.titulo) ??
      texto(aula.tema) ??
      texto(aula.titulo) ??
      "Aula";

    return {
      tema,
      casoTitulo: texto(aula.casoTitulo) ?? texto(caso?.titulo),
      casoDescricao: texto(caso?.descricao),
      area: texto(caso?.area),
      temaClinico: texto(caso?.tema),
      publico: texto(config.publico) ?? texto(aula.publico),
      duracao: texto(aula.duracao),
      formato: texto(aula.formato),
      objetivos: texto(aula.objetivos),
      fraquezas: await this.fraquezasAnteriores(aula.id, bloco.ordem),
      slideBase: slideBase(config.slideBase),
      instrucoesExtras: texto(config.instrucoesExtras),
      nSlides: inteiro(config.nSlides),
      nQuestoes: inteiro(config.nQuestoes),
      idioma: texto(config.idioma) ?? DEFAULT_IDIOMA,
    };
  }

  /**
   * Serializa o contexto como bloco de texto para o prompt. É o que substitui o
   * "prompt livre" do projeto de origem.
   */
  descrever(ctx: ContextoAula): string {
    const linhas: string[] = [`Tema da aula: ${ctx.tema}`];

    if (ctx.casoDescricao) {
      linhas.push(`Resumo do caso clínico: ${ctx.casoDescricao.slice(0, 800)}`);
    }
    if (ctx.area) linhas.push(`Especialidade: ${ctx.area}`);
    if (ctx.temaClinico)
      linhas.push(`Diagnóstico/tema clínico: ${ctx.temaClinico}`);
    if (ctx.publico) linhas.push(`Público-alvo: ${ctx.publico}`);
    if (ctx.duracao) linhas.push(`Duração da aula: ${ctx.duracao}`);
    if (ctx.formato) linhas.push(`Formato: ${ctx.formato}`);
    if (ctx.objetivos) {
      linhas.push(`Objetivos de aprendizagem: ${ctx.objetivos}`);
    }

    if (ctx.fraquezas.length > 0) {
      linhas.push(
        "",
        "A turma demonstrou dificuldade nos pontos abaixo — priorize-os:",
        ...ctx.fraquezas.map((f) => `- ${f}`),
      );
    }

    if (ctx.slideBase) {
      linhas.push(
        "",
        `O professor enviou a apresentação dele ("${ctx.slideBase.nome}") como BASE.`,
        "Siga a sequência, a linguagem e o recorte dela; complete lacunas e melhore",
        "a redação, mas não troque o roteiro por outro nem descarte assuntos que ela cobre.",
        "",
        "--- INÍCIO DO MATERIAL DE BASE ---",
        ctx.slideBase.texto,
        "--- FIM DO MATERIAL DE BASE ---",
      );
    }

    if (ctx.instrucoesExtras) {
      linhas.push(
        "",
        `Instruções adicionais do professor: ${ctx.instrucoesExtras}`,
      );
    }

    return linhas.join("\n");
  }

  /** Título/descrição/área/tema do caso, do acervo legado (read-only). */
  private async dadosDoCaso(casoLegacyId: number): Promise<{
    titulo: string | null;
    descricao: string | null;
    area: string | null;
    tema: string | null;
  } | null> {
    try {
      const rows = await this.read.query<{
        titulo: string | null;
        descricao: string | null;
        area: string | null;
        tema: string | null;
      }>(
        `SELECT COALESCE(c.catalogo_nome, c.nome)              AS titulo,
                COALESCE(c.catalogo_descricao, c.observacoes)  AS descricao,
                e.descricao                                    AS area,
                t.nome                                         AS tema
           FROM caso c
           LEFT JOIN especialidade e ON e.id = c.esp_id
           LEFT JOIN tema t          ON t.id = c.tem_id
          WHERE c.id = $1`,
        [casoLegacyId],
      );
      return rows[0] ?? null;
    } catch {
      // Banco legado indisponível não deve impedir a geração por tema.
      return null;
    }
  }

  /** Diagnóstico dos blocos de caso que vêm antes deste na sequência. */
  private async fraquezasAnteriores(
    aulaId: string,
    ordem: number,
  ): Promise<string[]> {
    const anteriores = await this.prisma.aulaBloco.findMany({
      where: { aulaId, tipo: "caso", ordem: { lt: ordem } },
      orderBy: { ordem: "asc" },
      select: { output: true },
    });

    const fraquezas: string[] = [];
    for (const bloco of anteriores) {
      const output = asObject(bloco.output as Prisma.JsonValue);
      const diagnostico = asObject(output?.diagnostico);
      const pontos = diagnostico?.pontosFracos;
      if (!Array.isArray(pontos)) continue;

      for (const ponto of pontos) {
        const obj = asObject(ponto);
        const titulo = texto(obj?.titulo);
        if (!titulo) continue;
        const descricao = texto(obj?.descricao);
        fraquezas.push(descricao ? `${titulo} — ${descricao}` : titulo);
      }
    }
    return fraquezas;
  }
}
