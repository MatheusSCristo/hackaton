import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { BlocosService } from "../aulas/blocos.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { EnqueteIaService } from "./enquete-ia.service";
import type { PerguntaEnquete } from "./enquete-ia.service";
import { Poll360Service } from "./poll360.service";
import type { GerarEnqueteDto } from "./dto/enquete.dto";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

@Injectable()
export class EnqueteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocos: BlocosService,
    private readonly ia: EnqueteIaService,
    private readonly poll360: Poll360Service,
  ) {}

  /**
   * Gera as questões (rascunho) e guarda em `output.perguntas`.
   * Nada vai ao poll360 aqui — a publicação é um passo explícito do professor.
   */
  async gerar(
    aulaId: string,
    blocoId: string,
    professorId: string,
    dto: GerarEnqueteDto,
  ): Promise<BlocoDto> {
    const bloco = await this.blocos.getBloco(aulaId, blocoId, professorId);
    if (bloco.tipo !== "enquete") {
      throw new BadRequestException("Este bloco não é uma enquete.");
    }

    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula) throw new NotFoundException("Aula não encontrada.");

    const config = asObject(bloco.config) ?? {};
    const foco = config.foco === "fraquezas" ? "fraquezas" : "geral";
    const nPerguntas =
      dto.nPerguntas ??
      (typeof config.nPerguntas === "number" ? config.nPerguntas : undefined);

    // Foco em fraquezas só faz sentido se um bloco de caso ANTERIOR já produziu
    // diagnóstico. Sem isso, cai para enquete geral em vez de inventar gaps.
    const fraquezas =
      foco === "fraquezas"
        ? await this.fraquezasAnteriores(aulaId, bloco.ordem)
        : [];

    const perguntas = await this.ia.gerar({
      casoTitulo: aula.casoTitulo,
      tema: aula.tema,
      publico: aula.publico,
      objetivos: aula.objetivos,
      fraquezas,
      nPerguntas,
      idioma: dto.idioma,
    });

    return this.blocos.mergeOutput(blocoId, {
      perguntas,
      geradoEm: new Date().toISOString(),
      focoAplicado: fraquezas.length > 0 ? "fraquezas" : "geral",
      ia: true,
    });
  }

  /** Publica o rascunho revisado no poll360 (cria package + polls + opções). */
  async publicar(
    aulaId: string,
    blocoId: string,
    professorId: string,
    token: string,
    empId: number | undefined,
  ): Promise<BlocoDto> {
    if (empId === undefined) {
      throw new BadRequestException("Empresa não identificada no token.");
    }
    const bloco = await this.blocos.getBloco(aulaId, blocoId, professorId);
    const output = asObject(bloco.output) ?? {};
    const perguntas = lerPerguntas(output.perguntas);

    if (perguntas.length === 0) {
      throw new BadRequestException(
        "Gere (e revise) as questões antes de publicar.",
      );
    }

    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    const nomePacote = aula?.titulo?.trim() || "Enquete da aula";

    const { packageId, pollIds } = await this.poll360.criarPacote(
      token,
      empId,
      nomePacote,
      perguntas,
    );

    return this.blocos.mergeOutput(blocoId, {
      poll360PackageId: packageId,
      poll360PollIds: pollIds,
      publicadoEm: new Date().toISOString(),
    });
  }

  /**
   * Abre a questão `indice` ao vivo no poll360 e devolve PIN + URL de entrada.
   *
   * No poll360 **uma sessão vale uma questão**: `sessions/start` recebe um
   * `pollId` só, e `poll:start` sobe justamente o poll daquela sessão. Avançar
   * de questão, portanto, é abrir uma sessão nova para o `pollId` seguinte —
   * e o `StartPoll360PollSessionUseCase` reaproveita o `accessPin` da sessão
   * anterior, então a turma **não** precisa reentrar com outro PIN.
   */
  async iniciar(
    aulaId: string,
    blocoId: string,
    professorId: string,
    token: string,
    indice = 0,
  ): Promise<BlocoDto> {
    const bloco = await this.blocos.getBloco(aulaId, blocoId, professorId);
    const output = asObject(bloco.output) ?? {};

    const packageId =
      typeof output.poll360PackageId === "string"
        ? output.poll360PackageId
        : null;
    const pollIds = Array.isArray(output.poll360PollIds)
      ? output.poll360PollIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [];

    if (!packageId || pollIds.length === 0) {
      throw new BadRequestException("Publique a enquete antes de iniciar.");
    }

    if (!Number.isInteger(indice) || indice < 0 || indice >= pollIds.length) {
      throw new BadRequestException(
        `Questão ${indice + 1} não existe nesta enquete (são ${pollIds.length}).`,
      );
    }

    const { accessPin, joinUrl } = await this.poll360.iniciarSessao(
      token,
      packageId,
      pollIds[indice],
    );

    return this.blocos.mergeOutput(blocoId, {
      accessPin,
      joinUrl,
      questaoAtual: indice,
      totalQuestoes: pollIds.length,
      iniciadoEm: new Date().toISOString(),
    });
  }

  /**
   * Coleta os pontos fracos diagnosticados por blocos de caso que vêm ANTES
   * deste na sequência — é assim que o encadeamento funciona sem impor ordem.
   */
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
        const titulo = obj?.titulo;
        const descricao = obj?.descricao;
        if (typeof titulo === "string" && titulo.trim()) {
          fraquezas.push(
            typeof descricao === "string" && descricao.trim()
              ? `${titulo.trim()} — ${descricao.trim()}`
              : titulo.trim(),
          );
        }
      }
    }
    return fraquezas;
  }
}

function lerPerguntas(raw: unknown): PerguntaEnquete[] {
  if (!Array.isArray(raw)) return [];
  const perguntas: PerguntaEnquete[] = [];

  for (const item of raw) {
    const obj = asObject(item);
    const enunciado = obj?.enunciado;
    const opcoes = obj?.opcoes;
    if (typeof enunciado !== "string" || !Array.isArray(opcoes)) continue;

    const normalizadas = opcoes
      .map((opcao) => {
        const o = asObject(opcao);
        const texto = o?.texto;
        if (typeof texto !== "string" || !texto.trim()) return null;
        const pontos = Number(o?.pontos);
        return {
          texto: texto.trim(),
          correta: o?.correta === true,
          justificativa:
            typeof o?.justificativa === "string" ? o.justificativa : "",
          pontos: Number.isFinite(pontos) ? Math.max(0, Math.trunc(pontos)) : 0,
        };
      })
      .filter((o): o is PerguntaEnquete["opcoes"][number] => o !== null);

    if (normalizadas.length > 0) {
      perguntas.push({ enunciado: enunciado.trim(), opcoes: normalizadas });
    }
  }
  return perguntas;
}
