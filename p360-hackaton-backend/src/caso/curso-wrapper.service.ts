import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { LegacyDbWriteService } from "../legacy-db/legacy-db-write.service";
import { LegacyDbService } from "../legacy-db/legacy-db.service";

/** Valores de referência verificados no banco `avp`. */
const TPA_ID_CASO = 1; // tipoaula: 1 = Caso
const STATUS_ID_PUBLICADO = 6; // casostatus: 6 = Publicado

/**
 * Minúsculo de propósito: é a convenção real do banco (1353 cursos em `pt-br`,
 * nenhum em `pt-BR` fora dos que criamos). O legado usa `curso.idioma` para
 * escolher o arquivo de tradução — com `pt-BR` nada casa e o player renderiza as
 * chaves cruas (`{{__cursorun.*__}}`).
 *
 * Só é usado como reserva: o wrapper herda o idioma do próprio caso, porque há
 * casos em espanhol/inglês no acervo e o chrome do player deve acompanhar.
 */
const IDIOMA_PADRAO = "pt-br";

export interface TurmaLegacy {
  id: number;
  nome: string;
  codigoAcesso: string | null;
}

export interface PreparoCaso {
  cursoLegacyId: number;
  turmaCursoId: number;
}

/**
 * Prepara o caso da aula no legado, via SQL direto e parametrizado.
 *
 * Todo o SQL legado de escrita vive aqui (e as leituras correlatas), para que
 * uma mudança de schema do `avp` quebre num único lugar.
 */
@Injectable()
export class CursoWrapperService {
  private readonly logger = new Logger(CursoWrapperService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly read: LegacyDbService,
    private readonly write: LegacyDbWriteService,
  ) {}

  /** Turmas da empresa do professor (com o código de acesso para os alunos). */
  async listarTurmas(empId: number): Promise<TurmaLegacy[]> {
    const rows = await this.read.query<{
      id: number;
      nome: string;
      codigo_acesso: string | null;
    }>(
      `SELECT id, nome, codigo_acesso
         FROM turma
        WHERE emp_id = $1 AND COALESCE(status, true) = true
        ORDER BY nome`,
      [empId],
    );
    return rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      codigoAcesso: row.codigo_acesso,
    }));
  }

  /**
   * Garante o curso-wrapper e a atribuição à turma.
   *
   * Idempotente: reusa o wrapper de (caso, empresa) e faz upsert do
   * `turmacurso` (único em `curso_id, tma_id`). Deixa `status=false` — quem
   * libera é o professor, no momento da aula.
   */
  async preparar(params: {
    casoLegacyId: number;
    empId: number;
    turmaId: number;
    professorLegacyId: number;
    professorId: string;
    sessaoId?: string;
    blocoId?: string;
  }): Promise<PreparoCaso> {
    const cursoLegacyId = await this.garantirWrapper(params);
    const turmaCursoId = await this.atribuirTurma({
      ...params,
      cursoLegacyId,
    });
    return { cursoLegacyId, turmaCursoId };
  }

  private async garantirWrapper(params: {
    casoLegacyId: number;
    empId: number;
    professorId: string;
    sessaoId?: string;
    blocoId?: string;
  }): Promise<number> {
    const { casoLegacyId, empId } = params;

    const existente = await this.prisma.cursoWrapper.findUnique({
      where: { casoLegacyId_empId: { casoLegacyId, empId } },
    });
    if (existente) return existente.cursoLegacyId;

    const cursoLegacyId = await this.write.transaction(async (client) => {
      // Herda nome/especialidade/tema do próprio caso: mantém o wrapper
      // coerente e satisfaz os joins de catálogo/relatório.
      const curso = await client.query<{ id: number }>(
        `INSERT INTO curso (nome, status_id, esp_id, tem_id, idioma,
                            certificado, overview, createdat, updatedat)
         SELECT COALESCE(c.catalogo_nome, c.nome), $2, c.esp_id, c.tem_id,
                COALESCE(NULLIF(c.idioma, ''), $3), false, false, now(), now()
           FROM caso c
          WHERE c.id = $1
         RETURNING id`,
        [casoLegacyId, STATUS_ID_PUBLICADO, IDIOMA_PADRAO],
      );

      const novoId = curso.rows[0]?.id;
      if (!novoId) {
        throw new BadRequestException(
          `Caso ${casoLegacyId} não encontrado no acervo.`,
        );
      }

      // `nome` é NOT NULL em cursoaula; `tpa_id=1` marca o item como caso.
      await client.query(
        `INSERT INTO cursoaula (curso_id, caso_id, tpa_id, nome, ordem,
                                required, createdat, updatedat)
         SELECT $1, c.id, $3, COALESCE(c.catalogo_nome, c.nome), 1, true,
                now(), now()
           FROM caso c
          WHERE c.id = $2`,
        [novoId, casoLegacyId, TPA_ID_CASO],
      );

      // Dá acesso do curso à empresa do professor.
      await client.query(
        `INSERT INTO empresacurso (curso_id, emp_id, status, free,
                                   createdat, updatedat)
         VALUES ($1, $2, true, false, now(), now())`,
        [novoId, empId],
      );

      return novoId;
    });

    await this.prisma.cursoWrapper.create({
      data: { casoLegacyId, empId, cursoLegacyId },
    });

    await this.auditar({
      ...params,
      acao: "criar_wrapper",
      tabela: "curso",
      registroId: String(cursoLegacyId),
      payload: { casoLegacyId, empId, cursoLegacyId },
    });

    this.logger.log(
      `Curso-wrapper ${cursoLegacyId} criado para caso ${casoLegacyId} (emp ${empId}).`,
    );
    return cursoLegacyId;
  }

  private async atribuirTurma(params: {
    cursoLegacyId: number;
    turmaId: number;
    professorLegacyId: number;
    professorId: string;
    sessaoId?: string;
    blocoId?: string;
  }): Promise<number> {
    const { cursoLegacyId, turmaId, professorLegacyId } = params;

    // `agendamento=false` mantém o cron `/cron/cursos-agendados` fora do
    // caminho: quem alterna `status` é o professor, não a janela de datas.
    const rows = await this.write.query<{ id: number }>(
      `INSERT INTO turmacurso (curso_id, tma_id, usu_id, status, agendamento,
                               bloquear_exame_fisico, bloquear_diagnostico,
                               createdat, updatedat)
       VALUES ($1, $2, $3, false, false, false, false, now(), now())
       ON CONFLICT (curso_id, tma_id)
         DO UPDATE SET updatedat = now()
       RETURNING id`,
      [cursoLegacyId, turmaId, professorLegacyId],
    );

    const turmaCursoId = rows[0]?.id;
    if (!turmaCursoId) {
      throw new BadRequestException(
        "Não foi possível atribuir o caso à turma.",
      );
    }

    await this.auditar({
      ...params,
      acao: "atribuir_turmacurso",
      tabela: "turmacurso",
      registroId: String(turmaCursoId),
      payload: { cursoLegacyId, turmaId },
    });

    return turmaCursoId;
  }

  /**
   * Liga/desliga o acesso da turma ao curso-wrapper.
   *
   * Idempotente: escreve o estado desejado em vez de alternar — protege contra
   * duplo-clique e retry de rede.
   */
  async definirLiberacao(params: {
    turmaCursoId: number;
    liberado: boolean;
    professorId: string;
    sessaoId?: string;
    blocoId?: string;
  }): Promise<void> {
    await this.write.query(
      `UPDATE turmacurso SET status = $2, updatedat = now() WHERE id = $1`,
      [params.turmaCursoId, params.liberado],
    );

    await this.auditar({
      ...params,
      acao: params.liberado ? "liberar" : "encerrar",
      tabela: "turmacurso",
      registroId: String(params.turmaCursoId),
      payload: { liberado: params.liberado },
    });
  }

  /**
   * Matricula o aluno na turma da sessão, se ainda não estiver.
   *
   * Sem isso o aluno bateria num 403 sem entender o motivo. É um efeito com
   * peso acadêmico, por isso fica auditado — e a UI avisa o aluno.
   */
  async garantirMatricula(params: {
    turmaId: number;
    usuarioLegacyId: number;
    professorId: string;
    sessaoId?: string;
    blocoId?: string;
  }): Promise<boolean> {
    const rows = await this.write.query<{ id: number }>(
      `INSERT INTO turmausuario (tma_id, usu_id, createdat, updatedat)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (tma_id, usu_id) DO NOTHING
       RETURNING id`,
      [params.turmaId, params.usuarioLegacyId],
    );

    const matriculou = rows.length > 0;
    if (matriculou) {
      await this.auditar({
        ...params,
        acao: "matricular_aluno",
        tabela: "turmausuario",
        registroId: String(rows[0].id),
        payload: { turmaId: params.turmaId, usuarioId: params.usuarioLegacyId },
      });
    }
    return matriculou;
  }

  /** Dados do caso necessários para montar o deep-link (título e modalidade). */
  async dadosDoCaso(
    casoLegacyId: number,
  ): Promise<{ nome: string; tipoclinico: string | null } | null> {
    const rows = await this.read.query<{
      nome: string;
      tipoclinico: string | null;
    }>(
      `SELECT COALESCE(catalogo_nome, nome) AS nome, tipoclinico
         FROM caso WHERE id = $1`,
      [casoLegacyId],
    );
    return rows[0] ?? null;
  }

  private async auditar(params: {
    acao: string;
    tabela: string;
    registroId: string;
    payload: Record<string, unknown>;
    professorId: string;
    sessaoId?: string;
    blocoId?: string;
  }): Promise<void> {
    await this.prisma.legacyWriteLog.create({
      data: {
        acao: params.acao,
        tabela: params.tabela,
        registroId: params.registroId,
        payload: params.payload as Prisma.InputJsonValue,
        professorId: params.professorId,
        sessaoId: params.sessaoId ?? null,
        blocoId: params.blocoId ?? null,
      },
    });
  }
}
