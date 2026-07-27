import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { BlocosService } from "../aulas/blocos.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";
import { SessaoService } from "../sessao/sessao.service";
import { CasoColetaService } from "./caso-coleta.service";
import type { AgregadoCaso } from "./caso-coleta.service";
import { CasoDiagnosticoService } from "./caso-diagnostico.service";
import { CursoWrapperService } from "./curso-wrapper.service";

/** Validade do link de acesso ao caso. Curta: é gate de sala de aula. */
const NONCE_TTL_MINUTOS = 180;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

interface ConfigCaso {
  casoLegacyId: number;
  turmaId: number;
  modo: "apresenta" | "autonomo";
}

@Injectable()
export class CasoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly blocos: BlocosService,
    private readonly sessao: SessaoService,
    private readonly wrapper: CursoWrapperService,
    private readonly coleta: CasoColetaService,
    private readonly diagnostico: CasoDiagnosticoService,
  ) {}

  /**
   * Cria/reusa o curso-wrapper e atribui à turma, deixando **fechado**.
   * Quem libera é o professor, no momento da aula.
   */
  async preparar(
    aulaId: string,
    blocoId: string,
    professorId: string,
    empId: number | undefined,
    professorLegacyId: number | undefined,
  ): Promise<BlocoDto> {
    if (empId === undefined || professorLegacyId === undefined) {
      throw new BadRequestException(
        "Empresa/professor não identificados no token.",
      );
    }

    const { cfg } = await this.carregar(aulaId, blocoId, professorId);
    const { cursoLegacyId, turmaCursoId } = await this.wrapper.preparar({
      casoLegacyId: cfg.casoLegacyId,
      empId,
      turmaId: cfg.turmaId,
      professorLegacyId,
      professorId,
      blocoId,
    });

    return this.blocos.mergeOutput(blocoId, {
      cursoLegacyId,
      turmaCursoId,
      preparadoEm: new Date().toISOString(),
    });
  }

  /** Abre o acesso da turma ao caso (idempotente). */
  async liberar(
    sessaoId: string,
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<BlocoDto> {
    const { bloco, output } = await this.carregar(aulaId, blocoId, professorId);
    const turmaCursoId = Number(output.turmaCursoId);
    if (!turmaCursoId) {
      throw new BadRequestException("Prepare o caso antes de liberar.");
    }

    await this.wrapper.definirLiberacao({
      turmaCursoId,
      liberado: true,
      professorId,
      sessaoId,
      blocoId,
    });

    // Uma ação só: abre o acesso no legado E marca o bloco como a atividade
    // corrente da sessão (é o que faz a sala do aluno reagir).
    await this.sessao.liberarBloco(sessaoId, blocoId, professorId);

    return this.blocos.mergeOutput(bloco.id, {
      liberadoEm: new Date().toISOString(),
      encerradoEm: null,
    });
  }

  /**
   * Fecha o acesso e **coleta** o desempenho da janela, gerando o diagnóstico
   * que os blocos seguintes consomem.
   */
  async encerrar(
    sessaoId: string,
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<BlocoDto> {
    const { bloco, output } = await this.carregar(aulaId, blocoId, professorId);
    const turmaCursoId = Number(output.turmaCursoId);
    if (turmaCursoId) {
      await this.wrapper.definirLiberacao({
        turmaCursoId,
        liberado: false,
        professorId,
        sessaoId,
        blocoId,
      });
    }

    await this.sessao.encerrarBloco(sessaoId, blocoId, professorId);

    const encerradoEm = new Date();
    await this.blocos.mergeOutput(bloco.id, {
      encerradoEm: encerradoEm.toISOString(),
    });

    // Coleta na sequência: é o que gera o diagnóstico para os blocos seguintes.
    return this.coletar(aulaId, blocoId, professorId);
  }

  /** Coleta o agregado + diagnóstico. Pode ser reexecutada ("atualizar"). */
  async coletar(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<BlocoDto> {
    const { bloco, aula, output, cfg } = await this.carregar(
      aulaId,
      blocoId,
      professorId,
    );
    const janela = this.lerJanela(output);

    const agregado = await this.coleta.agregar({
      turmaId: cfg.turmaId,
      casoLegacyId: cfg.casoLegacyId,
      inicio: janela.inicio,
      fim: janela.fim,
    });

    const diagnostico = await this.diagnostico.diagnosticar(agregado, {
      casoTitulo: aula.casoTitulo,
      publico: aula.publico,
    });

    await this.atualizarMetricaDaAula(aulaId, agregado);

    return this.blocos.mergeOutput(bloco.id, {
      agregado,
      diagnostico,
      coletadoEm: new Date().toISOString(),
    });
  }

  /** Contador "X de Y concluíram" — consulta leve para o cockpit. */
  async progresso(
    aulaId: string,
    blocoId: string,
    professorId: string,
  ): Promise<{ concluidos: number; iniciaram: number; alunosTotal: number }> {
    const { output, cfg } = await this.carregar(aulaId, blocoId, professorId);
    const janela = this.lerJanela(output);

    return this.coleta.progresso({
      turmaId: cfg.turmaId,
      casoLegacyId: cfg.casoLegacyId,
      inicio: janela.inicio,
      fim: janela.fim,
    });
  }

  /**
   * Autoriza o aluno e devolve o **link do player legado**, pronto para abrir.
   *
   * Um passo só, de propósito: abrir o caso é uma navegação do browser
   * (`window.open`), que **não** envia `X-Access-Token` — só XHR envia. Um
   * endpoint intermediário de redirect nunca conseguiria autenticar, então a
   * autorização acontece aqui (XHR autenticado) e o cliente recebe a URL final.
   *
   * O gate é nosso porque o legado não valida `turmacurso.status` no deep-link
   * do player — ver o plano (§13.4/§13.5).
   */
  async autorizarAluno(params: {
    sessaoId: string;
    blocoId: string;
    usuarioLegacyId: number;
    tokenAluno: string;
  }): Promise<{ url: string }> {
    const liberado = await this.sessao.blocoEstaLiberado(
      params.sessaoId,
      params.blocoId,
    );
    if (!liberado) {
      throw new ForbiddenException(
        "Esta atividade não está liberada pelo professor.",
      );
    }

    const bloco = await this.prisma.aulaBloco.findUnique({
      where: { id: params.blocoId },
      include: { aula: { select: { casoLegacyId: true } } },
    });
    if (!bloco) throw new NotFoundException("Bloco não encontrado.");

    const cfg = this.lerConfig(bloco.config, bloco.aula.casoLegacyId);
    const sessao = await this.prisma.sessaoAula.findUnique({
      where: { id: params.sessaoId },
      select: { professorId: true },
    });

    // Sem matrícula o aluno bateria num 403 sem entender o motivo.
    await this.wrapper.garantirMatricula({
      turmaId: cfg.turmaId,
      usuarioLegacyId: params.usuarioLegacyId,
      professorId: sessao?.professorId ?? "sistema",
      sessaoId: params.sessaoId,
      blocoId: params.blocoId,
    });

    const output = asObject(bloco.output) ?? {};
    const cursoLegacyId = Number(output.cursoLegacyId);
    if (!cursoLegacyId) {
      throw new BadRequestException("Caso ainda não preparado.");
    }

    const base = (this.config.get<string>("AVP_EMPRESAS_URL") ?? "").replace(
      /\/+$/,
      "",
    );
    if (!base) {
      throw new BadRequestException(
        "AVP_EMPRESAS_URL não configurada — não é possível montar o link do caso.",
      );
    }

    const dados = await this.wrapper.dadosDoCaso(cfg.casoLegacyId);

    // Trilha de auditoria de quem abriu o caso e quando. Registro só para
    // rastreio: quem controla o acesso é a liberação do bloco, checada acima.
    await this.prisma.casoAcessoNonce.create({
      data: {
        nonce: randomBytes(24).toString("base64url"),
        sessaoId: params.sessaoId,
        blocoId: params.blocoId,
        usuarioId: String(params.usuarioLegacyId),
        expiraEm: new Date(Date.now() + NONCE_TTL_MINUTOS * 60_000),
        usadoEm: new Date(),
      },
    });

    // Usa o ponto de entrada SSO do próprio avp-empresas
    // (`$urlRouterProvider.otherwise` em `core.module.js:1270-1358`): ele
    // autentica pelo `?t=`, faz o `btoa()` dos ids internamente e já navega com
    // `exit:false` (modo quiosque).
    //
    // Não montamos o deep-link com hash à mão: os segmentos precisariam ir em
    // base64, que pode conter "/" e quebra o casamento da rota — foi o que fazia
    // a aba cair em /app/cursos (o fallback do `otherwise`).
    const query = new URLSearchParams({
      t: params.tokenAluno,
      directCase: String(cfg.casoLegacyId),
      curso_id: String(cursoLegacyId),
    });

    // O legado escolhe o player pelo `clinicalType`; sem ele, assume caso comum.
    if (dados?.tipoclinico === "comunicacao") {
      query.set("clinicalType", "comunicacao");
    }

    return { url: `${base}/?${query.toString()}` };
  }

  /**
   * Substitui a métrica mock por dados reais. Manter números aleatórios ao lado
   * de dados de verdade mina a confiança em todo o dashboard.
   */
  private async atualizarMetricaDaAula(
    aulaId: string,
    agregado: AgregadoCaso,
  ): Promise<void> {
    if (agregado.alunosTotal === 0) return;

    const mediaAcertos = Math.round(
      agregado.etapas.reduce((soma, e) => soma + e.porcentagem, 0) /
        Math.max(1, agregado.etapas.length),
    );

    await this.prisma.aulaMetrica.upsert({
      where: { aulaId },
      create: {
        aulaId,
        alunosTotal: agregado.alunosTotal,
        alunosEngajados: agregado.alunosEngajados,
        mediaAcertos,
        taxaConclusao: agregado.taxaConclusao,
      },
      update: {
        alunosTotal: agregado.alunosTotal,
        alunosEngajados: agregado.alunosEngajados,
        mediaAcertos,
        taxaConclusao: agregado.taxaConclusao,
      },
    });
  }

  private async carregar(aulaId: string, blocoId: string, professorId: string) {
    const bloco = await this.blocos.getBloco(aulaId, blocoId, professorId);
    if (bloco.tipo !== "caso") {
      throw new BadRequestException("Este bloco não é um caso clínico.");
    }
    const aula = await this.prisma.aula.findUnique({ where: { id: aulaId } });
    if (!aula) throw new NotFoundException("Aula não encontrada.");

    return {
      bloco,
      aula,
      output: asObject(bloco.output) ?? {},
      cfg: this.lerConfig(bloco.config, aula.casoLegacyId),
    };
  }

  /**
   * O caso já foi escolhido na aula — o bloco herda `casoLegacyId` por padrão e
   * só precisa da turma. `config.casoLegacyId` permite sobrescrever.
   */
  private lerConfig(config: unknown, casoDaAula?: number | null): ConfigCaso {
    const obj = asObject(config) ?? {};
    const casoLegacyId = Number(obj.casoLegacyId) || Number(casoDaAula) || 0;
    const turmaId = Number(obj.turmaId);
    const modo = obj.modo === "apresenta" ? "apresenta" : "autonomo";

    if (!casoLegacyId) {
      throw new BadRequestException(
        "Esta aula não tem um caso do acervo — escolha o caso antes de continuar.",
      );
    }
    if (!turmaId) {
      throw new BadRequestException(
        "Escolha a turma neste bloco antes de continuar.",
      );
    }
    return { casoLegacyId, turmaId, modo };
  }

  /**
   * Janela da sessão. Sem `liberadoEm` não há recorte — e agregar "tudo" traria
   * execuções de outras aulas do mesmo caso/turma.
   */
  private lerJanela(output: JsonObject): { inicio: Date; fim: Date } {
    const liberadoEm =
      typeof output.liberadoEm === "string"
        ? new Date(output.liberadoEm)
        : null;
    if (!liberadoEm || Number.isNaN(liberadoEm.getTime())) {
      throw new BadRequestException(
        "O caso ainda não foi liberado — não há janela para coletar.",
      );
    }
    const encerradoEm =
      typeof output.encerradoEm === "string"
        ? new Date(output.encerradoEm)
        : null;

    return {
      inicio: liberadoEm,
      fim:
        encerradoEm && !Number.isNaN(encerradoEm.getTime())
          ? encerradoEm
          : new Date(),
    };
  }
}
