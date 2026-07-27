import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { BlocosService } from "../aulas/blocos.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { SessaoService } from "../sessao/sessao.service";
import { ContextoAulaService } from "./contexto-aula.service";
import { IaJsonService } from "./ia-json.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { PptxRendererService } from "./pptx-renderer.service";
import { ResumoIaService } from "./resumo-ia.service";
import { SimuladoIaService } from "./simulado-ia.service";
import { SlidesIaService } from "./slides-ia.service";
import { apresentacaoSchema, resumoSchema, simuladoSchema } from "./schemas";
import type { Apresentacao, Simulado } from "./schemas";

export interface ArquivoGerado {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

/** Simulado como o aluno vê: sem gabarito e sem explicações. */
export interface SimuladoParaAluno {
  title: string;
  aulaTitulo: string;
  questions: {
    statement: string;
    alternatives: { label: string; text: string }[];
  }[];
  /** Tentativa já enviada, quando houver. */
  resultado: ResultadoSimulado | null;
  /** O professor liberou o gabarito comentado? */
  gabaritoLiberado: boolean;
}

export interface ResultadoSimulado {
  acertos: number;
  total: number;
  percentual: number;
  submittedAt: string;
  /**
   * Correção detalhada. Vazia enquanto o professor não libera o gabarito
   * comentado — o aluno vê a nota, mas não as respostas.
   */
  correcao: {
    statement: string;
    escolhida: string | null;
    correta: string;
    acertou: boolean;
    explicacao: string;
    alternativas: {
      label: string;
      text: string;
      isCorrect: boolean;
      explicacaoSeIncorreta?: string;
    }[];
  }[];
}

const TIPOS_GERAVEIS = ["slides", "simulado", "resumo"] as const;
type TipoGeravel = (typeof TIPOS_GERAVEIS)[number];

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "material"
  );
}

@Injectable()
export class MateriaisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocos: BlocosService,
    private readonly contexto: ContextoAulaService,
    private readonly slidesIa: SlidesIaService,
    private readonly simuladoIa: SimuladoIaService,
    private readonly resumoIa: ResumoIaService,
    private readonly pptx: PptxRendererService,
    private readonly pdf: PdfRendererService,
    private readonly ia: IaJsonService,
    private readonly sessao: SessaoService,
  ) {}

  /**
   * Gera o material do bloco a partir do que o professor já escolheu.
   *
   * Não há prompt a escrever: o contexto vem da aula (caso/tema/público/
   * objetivos) e de blocos anteriores. `bloco.config` traz só personalizações.
   */
  async gerar(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<BlocoDto> {
    const { bloco, aula } = await this.carregar(aulaId, blocoId, professorId);
    const tipo = bloco.tipo as TipoGeravel;
    const ctx = await this.contexto.montar(aula, bloco);

    if (tipo === "slides") {
      const apresentacao = await this.slidesIa.gerar(ctx);
      return this.blocos.mergeOutput(blocoId, {
        apresentacao,
        geradoEm: new Date().toISOString(),
        ia: true,
      });
    }

    // Simulado e resumo aproveitam os slides já gerados na aula, quando houver:
    // assim cobrem o que foi efetivamente apresentado.
    const apresentacao = await this.apresentacaoDaAula(aulaId);

    if (tipo === "simulado") {
      const simulado = await this.simuladoIa.gerar(ctx, apresentacao);
      return this.blocos.mergeOutput(blocoId, {
        simulado,
        geradoEm: new Date().toISOString(),
        ia: true,
      });
    }

    const resumo = await this.resumoIa.gerar(ctx, apresentacao);
    return this.blocos.mergeOutput(blocoId, {
      resumo,
      geradoEm: new Date().toISOString(),
      ia: true,
    });
  }

  /**
   * Renderiza o arquivo sob demanda a partir da estrutura salva.
   *
   * Guardamos só o JSON no banco (não o binário): mantém a tabela pequena,
   * permite reeditar e alimenta o viewer da sala.
   */
  async baixar(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<ArquivoGerado> {
    const { bloco } = await this.carregar(aulaId, blocoId, professorId);
    const output = asObject(bloco.output) ?? {};

    if (bloco.tipo === "slides") {
      const apresentacao = this.lerApresentacao(output.apresentacao);
      const buffer = await this.pptx.render(apresentacao);
      return {
        buffer,
        filename: `${slug(apresentacao.title)}.pptx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
    }

    if (bloco.tipo === "resumo") {
      const parsed = resumoSchema.safeParse(output.resumo);
      if (!parsed.success) {
        throw new BadRequestException("Gere o resumo antes de baixar.");
      }
      const buffer = await this.pdf.renderResumo(parsed.data);
      return {
        buffer,
        filename: `${slug(parsed.data.title)}-resumo.pdf`,
        mimeType: "application/pdf",
      };
    }

    throw new BadRequestException(
      "Este tipo de bloco não gera arquivo para download.",
    );
  }

  // ------------------------------------------------------------ aluno

  /** Slides para a sala do aluno — navegação livre, sem gabarito a esconder. */
  async slidesParaAluno(
    sessaoId: string,
    blocoId: string,
  ): Promise<Apresentacao> {
    await this.assertBlocoLiberado(sessaoId, blocoId);
    const bloco = await this.blocoPorId(blocoId);
    const output = asObject(bloco.output) ?? {};
    return this.lerApresentacao(output.apresentacao);
  }

  /**
   * Simulado para o aluno responder **em casa** — fora da sessão ao vivo.
   *
   * O gate aqui é a publicação pelo professor ("disponibilizar para a turma"),
   * não a liberação de um bloco na aula: pós-aula não é conduzido ao vivo.
   */
  async simuladoPorBloco(
    blocoId: string,
    usuarioId: string,
  ): Promise<SimuladoParaAluno> {
    const bloco = await this.prisma.aulaBloco.findUnique({
      where: { id: blocoId },
      include: { aula: { select: { titulo: true } } },
    });
    if (!bloco) throw new NotFoundException("Simulado não encontrado.");
    if (bloco.tipo !== "simulado") {
      throw new BadRequestException("Este material não é um simulado.");
    }

    const output = asObject(bloco.output) ?? {};
    if (!output.publicadoEm) {
      throw new ForbiddenException(
        "Este simulado ainda não foi disponibilizado pelo professor.",
      );
    }

    const simulado = await this.lerSimuladoDoBloco(blocoId);
    const gabaritoLiberado = output.gabaritoLiberado === true;

    const tentativa = await this.prisma.simuladoTentativa.findUnique({
      where: { blocoId_usuarioId: { blocoId, usuarioId } },
    });

    return {
      title: simulado.title,
      aulaTitulo: bloco.aula.titulo,
      gabaritoLiberado,
      questions: simulado.questions.map((questao) => ({
        statement: questao.statement,
        alternatives: questao.alternatives.map((alt) => ({
          label: alt.label,
          text: alt.text,
        })),
      })),
      resultado: tentativa
        ? montarResultado(
            simulado,
            tentativa.respostas,
            {
              acertos: tentativa.acertos,
              total: tentativa.total,
              percentual: tentativa.percentual,
              submittedAt: tentativa.submittedAt,
            },
            gabaritoLiberado,
          )
        : null,
    };
  }

  /** Disponibiliza (ou recolhe) o material de pós-aula para a turma. */
  async publicarPosAula(
    aulaId: string,
    blocoId: string,
    professorId: string,
    publicado: boolean,
  ): Promise<BlocoDto> {
    await this.carregar(aulaId, blocoId, professorId);
    return this.blocos.mergeOutput(blocoId, {
      publicadoEm: publicado ? new Date().toISOString() : null,
    });
  }

  /** Libera (ou oculta) o gabarito comentado do simulado. */
  async definirGabarito(
    aulaId: string,
    blocoId: string,
    professorId: string,
    liberado: boolean,
  ): Promise<BlocoDto> {
    const { bloco } = await this.carregar(aulaId, blocoId, professorId);
    if (bloco.tipo !== "simulado") {
      throw new BadRequestException("Gabarito existe só no simulado.");
    }
    return this.blocos.mergeOutput(blocoId, {
      gabaritoLiberado: liberado,
      gabaritoLiberadoEm: liberado ? new Date().toISOString() : null,
    });
  }

  /** Corrige e persiste. Uma tentativa por aluno, como no projeto de origem. */
  async responderSimulado(
    blocoId: string,
    usuarioId: string,
    nome: string | undefined,
    respostas: { questaoIndex: number; alternativaLabel: string | null }[],
  ): Promise<ResultadoSimulado> {
    const bloco = await this.blocoPorId(blocoId);
    const output = asObject(bloco.output) ?? {};
    if (!output.publicadoEm) {
      throw new ForbiddenException(
        "Este simulado ainda não foi disponibilizado pelo professor.",
      );
    }
    const simulado = await this.lerSimuladoDoBloco(blocoId);

    const existente = await this.prisma.simuladoTentativa.findUnique({
      where: { blocoId_usuarioId: { blocoId, usuarioId } },
    });
    if (existente) {
      throw new ConflictException("Você já respondeu este simulado.");
    }

    const normalizadas = simulado.questions.map((questao, index) => {
      const resposta = respostas.find((r) => r.questaoIndex === index);
      const escolhida = resposta?.alternativaLabel ?? null;
      const correta =
        questao.alternatives.find((a) => a.isCorrect)?.label ?? null;
      return {
        questaoIndex: index,
        alternativaLabel: escolhida,
        acertou: escolhida !== null && escolhida === correta,
      };
    });

    const acertos = normalizadas.filter((r) => r.acertou).length;
    const total = simulado.questions.length;

    const tentativa = await this.prisma.simuladoTentativa.create({
      data: {
        blocoId,
        usuarioId,
        nome: nome ?? null,
        respostas: normalizadas as unknown as Prisma.InputJsonValue,
        acertos,
        total,
        percentual: total > 0 ? Math.round((100 * acertos) / total) : 0,
      },
    });

    return montarResultado(
      simulado,
      tentativa.respostas,
      {
        acertos: tentativa.acertos,
        total: tentativa.total,
        percentual: tentativa.percentual,
        submittedAt: tentativa.submittedAt,
      },
      output.gabaritoLiberado === true,
    );
  }

  /** Panorama das tentativas para o professor. */
  async resultadosDoSimulado(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ) {
    await this.carregar(aulaId, blocoId, professorId);
    const tentativas = await this.prisma.simuladoTentativa.findMany({
      where: { blocoId },
      orderBy: { submittedAt: "desc" },
    });

    const media = tentativas.length
      ? Math.round(
          tentativas.reduce((s, t) => s + t.percentual, 0) / tentativas.length,
        )
      : 0;

    return {
      totalRespondentes: tentativas.length,
      mediaPercentual: media,
      tentativas: tentativas.map((t) => ({
        usuarioId: t.usuarioId,
        nome: t.nome,
        acertos: t.acertos,
        total: t.total,
        percentual: t.percentual,
        submittedAt: t.submittedAt.toISOString(),
      })),
    };
  }

  get iaDisponivel(): boolean {
    return this.ia.enabled;
  }

  // ------------------------------------------------------------ internos

  private async carregar(aulaId: string, blocoId: string, professorId: string) {
    const bloco = await this.blocos.getBloco(aulaId, blocoId, professorId);
    if (!TIPOS_GERAVEIS.includes(bloco.tipo as TipoGeravel)) {
      throw new BadRequestException(
        "Este bloco não gera material (slides, simulado ou resumo).",
      );
    }
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula) throw new NotFoundException("Aula não encontrada.");
    return { bloco, aula };
  }

  private async blocoPorId(blocoId: string) {
    const bloco = await this.prisma.aulaBloco.findUnique({
      where: { id: blocoId },
    });
    if (!bloco) throw new NotFoundException("Bloco não encontrado.");
    return bloco;
  }

  private async assertBlocoLiberado(
    sessaoId: string,
    blocoId: string,
  ): Promise<void> {
    const liberado = await this.sessao.blocoEstaLiberado(sessaoId, blocoId);
    if (!liberado) {
      throw new ForbiddenException(
        "Esta atividade não está liberada pelo professor.",
      );
    }
  }

  /** Primeira apresentação gerada na aula, para contextualizar outros blocos. */
  private async apresentacaoDaAula(
    aulaId: string,
  ): Promise<Apresentacao | null> {
    const blocos = await this.prisma.aulaBloco.findMany({
      where: { aulaId, tipo: "slides" },
      orderBy: { ordem: "asc" },
      select: { output: true },
    });

    for (const bloco of blocos) {
      const output = asObject(bloco.output as Prisma.JsonValue);
      const parsed = apresentacaoSchema.safeParse(output?.apresentacao);
      if (parsed.success) return parsed.data;
    }
    return null;
  }

  private lerApresentacao(raw: unknown): Apresentacao {
    const parsed = apresentacaoSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException("Gere os slides antes de continuar.");
    }
    return parsed.data;
  }

  private async lerSimuladoDoBloco(blocoId: string): Promise<Simulado> {
    const bloco = await this.blocoPorId(blocoId);
    const output = asObject(bloco.output) ?? {};
    const parsed = simuladoSchema.safeParse(output.simulado);
    if (!parsed.success) {
      throw new BadRequestException("O simulado ainda não foi gerado.");
    }
    return parsed.data;
  }
}

/**
 * Monta o resultado. A correção detalhada só vai junto quando o professor
 * liberou o gabarito — antes disso o aluno vê apenas a nota.
 */
function montarResultado(
  simulado: Simulado,
  respostasSalvas: unknown,
  meta: {
    acertos: number;
    total: number;
    percentual: number;
    submittedAt: Date;
  },
  comGabarito: boolean,
): ResultadoSimulado {
  const respostas = Array.isArray(respostasSalvas)
    ? (respostasSalvas as {
        questaoIndex?: number;
        alternativaLabel?: string | null;
      }[])
    : [];

  return {
    acertos: meta.acertos,
    total: meta.total,
    percentual: meta.percentual,
    submittedAt: meta.submittedAt.toISOString(),
    correcao: !comGabarito
      ? []
      : simulado.questions.map((questao, index) => {
      const escolhida =
        respostas.find((r) => r.questaoIndex === index)?.alternativaLabel ??
        null;
      const correta =
        questao.alternatives.find((a) => a.isCorrect)?.label ?? "";
      return {
        statement: questao.statement,
        escolhida,
        correta,
        acertou: escolhida !== null && escolhida === correta,
        explicacao: questao.explanationCorrect,
        alternativas: questao.alternatives.map((alt) => ({
          label: alt.label,
          text: alt.text,
          isCorrect: alt.isCorrect,
          explicacaoSeIncorreta: alt.explanationIfIncorrect,
        })),
      };
    }),
  };
}
