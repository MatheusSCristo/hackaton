/**
 * Parte **legado** do seed de demonstração: turma, alunos e execução de casos
 * clínicos no banco `avp`.
 *
 * Escrever aqui é o que torna a demo coerente: a listagem de turmas, a
 * matrícula, o gate do caso e a coleta de desempenho leem tudo do legado. Sem
 * isso, os números do nosso banco ficariam soltos de qualquer turma real.
 *
 * Regras que este módulo respeita, e o motivo:
 *
 * - **Só INSERT.** Nenhum UPDATE ou DELETE em linha pré-existente. A única
 *   exceção é `limparLegado`, que apaga exclusivamente o que ele mesmo criou.
 * - **Tudo marcado.** Turma e usuário criados levam `external_id = SEED_TAG`;
 *   é por esse campo que a limpeza encontra o que remover. Sem marca não
 *   haveria como desfazer sem adivinhar.
 * - **Contas sem senha utilizável.** O `password` recebe um valor que não é
 *   hash bcrypt válido, então nenhum desses alunos consegue fazer login. São
 *   registros para relatório, não credenciais.
 * - **`createdat`/`updatedat` explícitos** — escrever direto contorna os hooks
 *   do LoopBack e essas colunas são NOT NULL sem default.
 */
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { QueryResultRow } from "pg";

/** Marca de origem, gravada em `external_id`. */
export const SEED_TAG = "seed-metricas";

/** `Usuário/Aluno` em `perfilusuario`. */
const PERFIL_ALUNO = 4;

/**
 * Etapas do caso na ordem em que o player as emite, com o tempo típico gasto.
 *
 * Os nomes dos eventos precisam casar com o que `CasoColetaService` procura —
 * é o que faz o painel do caso sair do zero.
 */
const ETAPAS_CASO = [
  { evento: "anamnese_play", segundos: 0 },
  { evento: "anamnese_end", segundos: 420 },
  { evento: "examefisico_play", segundos: 0 },
  { evento: "examefisico_end", segundos: 300 },
  { evento: "exame_play", segundos: 0 },
  { evento: "exame_end", segundos: 260 },
  { evento: "hipotese_end", segundos: 180 },
  { evento: "diagnostico_end", segundos: 150 },
  { evento: "conduta_end", segundos: 240 },
  { evento: "caso_end", segundos: 0 },
  { evento: "exit", segundos: 0 },
];

export interface AlunoLegado {
  id: number;
  nome: string;
  email: string;
}

export interface Turma {
  id: number;
  nome: string;
  codigoAcesso: string;
}

export interface ExecucaoDeCaso {
  casoLegacyId: number;
  cursoLegacyId: number | null;
  /** Quantos alunos chegaram ao fim (`caso_end`). */
  concluiram: number;
  /** Quantos abriram o caso. */
  iniciaram: number;
  inicio: Date;
  fim: Date;
}

function pool(): Pool {
  const host = process.env.LEGACY_PGHOST;
  const password =
    process.env.LEGACY_PGPASSWORD_WRITE || process.env.LEGACY_PGPASSWORD;

  if (!host || !password) {
    throw new Error(
      "LEGACY_PGHOST/LEGACY_PGPASSWORD ausentes — sem isso não há como preparar a turma no legado.",
    );
  }

  return new Pool({
    host,
    port: Number(process.env.LEGACY_PGPORT ?? 5432),
    user:
      process.env.LEGACY_PGUSER_WRITE || process.env.LEGACY_PGUSER || "postgres",
    password,
    database: process.env.LEGACY_PGDATABASE ?? "avp",
    max: 3,
  });
}

export class SeedLegado {
  private readonly db = pool();

  async fechar(): Promise<void> {
    await this.db.end();
  }

  private async q<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const r = await this.db.query<T>(sql, params);
    return r.rows;
  }

  /** Empresa pelo id, ou pelo nome quando o id não é conhecido. */
  async acharEmpresa(
    idOuNome: string,
  ): Promise<{ id: number; nome: string } | null> {
    const comoId = Number(idOuNome);
    if (Number.isInteger(comoId) && comoId > 0) {
      const rows = await this.q<{ id: number; nome: string }>(
        `SELECT id, nome FROM empresa WHERE id = $1`,
        [comoId],
      );
      return rows[0] ?? null;
    }

    const rows = await this.q<{ id: number; nome: string }>(
      `SELECT id, nome FROM empresa
        WHERE unaccent(nome) ILIKE unaccent($1)
        ORDER BY createdat DESC NULLS LAST
        LIMIT 1`,
      [`%${idOuNome}%`],
    );
    return rows[0] ?? null;
  }

  /**
   * Turma de demonstração da empresa. Idempotente por (empresa, nome).
   *
   * `status = true` porque uma turma inativa não aparece nos seletores — e o
   * ponto de existir é justamente poder escolhê-la na aula.
   */
  async garantirTurma(
    empId: number,
    nome: string,
    professorLegacyId: number,
  ): Promise<Turma> {
    const existente = await this.q<{
      id: number;
      nome: string;
      codigo_acesso: string | null;
    }>(
      `SELECT id, nome, codigo_acesso FROM turma
        WHERE emp_id = $1 AND nome = $2
        LIMIT 1`,
      [empId, nome],
    );

    if (existente[0]) {
      return {
        id: existente[0].id,
        nome: existente[0].nome,
        codigoAcesso: existente[0].codigo_acesso ?? "",
      };
    }

    const codigoAcesso = `HACK${String(empId).padStart(4, "0")}`;
    const criada = await this.q<{ id: number }>(
      `INSERT INTO turma (nome, emp_id, usu_id, status, codigo_acesso,
                          modo_avancado, external_id, createdat, updatedat)
       VALUES ($1, $2, $3, true, $4, false, $5, now(), now())
       RETURNING id`,
      [nome, empId, professorLegacyId, codigoAcesso, SEED_TAG],
    );

    return { id: criada[0].id, nome, codigoAcesso };
  }

  /**
   * Cria (ou reaproveita) os alunos e matricula todos na turma.
   *
   * A identidade é o e-mail, que tem índice único: rodar de novo reaproveita o
   * mesmo aluno em vez de estourar conflito ou duplicar gente.
   */
  async garantirAlunos(
    empId: number,
    turmaId: number,
    nomes: string[],
    dominio: string,
  ): Promise<AlunoLegado[]> {
    const alunos: AlunoLegado[] = [];

    for (const [i, nome] of nomes.entries()) {
      const email = `${slug(nome)}.${i + 1}@${dominio}`;

      const jaExiste = await this.q<{ id: number }>(
        `SELECT id FROM usuario WHERE email = $1`,
        [email],
      );

      let id = jaExiste[0]?.id;
      if (id === undefined) {
        // `password` recebe algo que não é bcrypt: a conta existe para o
        // relatório, não para logar. `acceptterms` já vem aceito para o
        // usuário nunca cair na tela de termos numa demo.
        const criado = await this.q<{ id: number }>(
          `INSERT INTO usuario (nome, email, password, status, acceptterms,
                                emailverified, external_id, createdat, updatedat)
           VALUES ($1, $2, $3, true, true, true, $4, now(), now())
           RETURNING id`,
          [nome, email, `sem-login:${randomUUID()}`, SEED_TAG],
        );
        id = criado[0].id;
      }

      await this.q(
        `INSERT INTO usuarioempresa (usu_id, empresa_id, perfil_id, padrao,
                                     createdat, updatedat)
         VALUES ($1, $2, $3, true, now(), now())
         ON CONFLICT (usu_id, empresa_id) DO NOTHING`,
        [id, empId, PERFIL_ALUNO],
      );

      await this.q(
        `INSERT INTO turmausuario (tma_id, usu_id, createdat, updatedat)
         VALUES ($1, $2, now(), now())
         ON CONFLICT (tma_id, usu_id) DO NOTHING`,
        [turmaId, id],
      );

      alunos.push({ id, nome, email });
    }

    return alunos;
  }

  /** Um caso do acervo acessível à empresa, preferindo os que têm thumbnail. */
  async escolherCaso(
    empId: number,
    excluir: number[],
  ): Promise<{ id: number; titulo: string } | null> {
    const rows = await this.q<{ id: number; titulo: string }>(
      `SELECT c.id, coalesce(c.catalogo_nome, c.nome) AS titulo
         FROM caso c
        WHERE c.versao = 2 AND c.tpc_id = 1
          AND NOT (c.id = ANY($2::int[]))
          AND c.id IN (
                SELECT ca.caso_id FROM cursoaula ca
                  JOIN empresacurso ec ON ec.curso_id = ca.curso_id
                 WHERE ec.emp_id = $1 AND ca.caso_id IS NOT NULL)
          AND nullif(btrim(coalesce(c.catalogo_imagem, c.catalogo_img)), '') IS NOT NULL
        ORDER BY c.id
        LIMIT 1`,
      [empId, excluir],
    );
    return rows[0] ?? null;
  }

  /** Curso (wrapper ou não) pelo qual a empresa alcança o caso. */
  private async cursoDoCaso(
    empId: number,
    casoLegacyId: number,
  ): Promise<number | null> {
    const rows = await this.q<{ curso_id: number }>(
      `SELECT ca.curso_id FROM cursoaula ca
         JOIN empresacurso ec ON ec.curso_id = ca.curso_id
        WHERE ec.emp_id = $1 AND ca.caso_id = $2
        LIMIT 1`,
      [empId, casoLegacyId],
    );
    return rows[0]?.curso_id ?? null;
  }

  /**
   * Simula a turma executando o caso: grava `caseevent` e `casotime`.
   *
   * `class_id` recebe a turma **de propósito**, mesmo sabendo que o player real
   * grava `accessToken.turma_id` (e frequentemente `NULL`) — aqui sabemos qual é
   * a turma e gravar certo mantém o dado consistente para qualquer relatório do
   * legado, não só para a nossa coleta (que usa `turmausuario`).
   *
   * Cada aluno para numa etapa diferente: um caso em que todos concluem não
   * mostra nada no gráfico de abandono por etapa.
   */
  async simularExecucaoDeCaso(params: {
    empId: number;
    turmaId: number;
    casoLegacyId: number;
    alunos: AlunoLegado[];
    quando: Date;
    /** Fração da turma que abre o caso. */
    participacao: number;
    aleatorio: () => number;
  }): Promise<ExecucaoDeCaso> {
    const {
      empId,
      turmaId,
      casoLegacyId,
      alunos,
      quando,
      participacao,
      aleatorio,
    } = params;

    const cursoLegacyId = await this.cursoDoCaso(empId, casoLegacyId);
    const participantes = alunos.slice(
      0,
      Math.max(1, Math.round(alunos.length * participacao)),
    );

    let concluiram = 0;
    const cliente = await this.db.connect();
    try {
      await cliente.query("BEGIN");

      for (const aluno of participantes) {
        // Onde este aluno parou. A maioria termina; alguns desistem no meio.
        const sorteio = aleatorio();
        const ateEtapa =
          sorteio < 0.62
            ? ETAPAS_CASO.length
            : sorteio < 0.78
              ? 9 // parou na conduta
              : sorteio < 0.9
                ? 7 // parou na hipótese
                : 4; // saiu no exame físico

        const sessionUuid = randomUUID();
        let instante = new Date(
          quando.getTime() + Math.floor(aleatorio() * 90) * 60 * 1000,
        );

        for (const etapa of ETAPAS_CASO.slice(0, ateEtapa)) {
          instante = new Date(instante.getTime() + etapa.segundos * 1000);

          await cliente.query(
            // Sem `lang`: o modelo do LoopBack declara a coluna, mas ela não
            // existe na tabela — a fonte da verdade aqui é o schema.
            `INSERT INTO caseevent (evento, usuario_id, caso_id, curso_id,
                                    company_id, class_id, session_uuid,
                                    createdat, updatedat)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
            [
              etapa.evento,
              aluno.id,
              casoLegacyId,
              cursoLegacyId,
              empId,
              turmaId,
              sessionUuid,
              instante,
            ],
          );

          if (etapa.segundos > 0) {
            // Tempo por etapa com ±30% de variação — média idêntica para todos
            // deixa o painel de tempos obviamente sintético.
            const segundos = Math.round(
              etapa.segundos * (0.7 + aleatorio() * 0.6),
            );
            await cliente.query(
              `INSERT INTO casotime (evento, tempo, caso_id, usuario_id,
                                     createdat, updatedat)
               VALUES ($1, make_interval(secs => $2), $3, $4, $5, $5)`,
              [etapa.evento, segundos, casoLegacyId, aluno.id, instante],
            );
          }
        }

        if (ateEtapa === ETAPAS_CASO.length) concluiram++;
      }

      await cliente.query("COMMIT");
    } catch (erro) {
      await cliente.query("ROLLBACK");
      throw erro;
    } finally {
      cliente.release();
    }

    return {
      casoLegacyId,
      cursoLegacyId,
      concluiram,
      iniciaram: participantes.length,
      // Janela um pouco maior que a execução, como a liberação/encerramento da
      // sessão real faria — a coleta filtra por ela.
      inicio: new Date(quando.getTime() - 5 * 60 * 1000),
      fim: new Date(quando.getTime() + 6 * 60 * 60 * 1000),
    };
  }

  /**
   * Roda a **mesma** agregação do `CasoColetaService` sobre o que acabou de ser
   * gravado, para guardar o resultado no `output` do bloco.
   *
   * Duplicar a query aqui é proposital: além de deixar o painel do caso cheio na
   * demo sem depender de o professor clicar em "coletar", serve de conferência —
   * se este número der zero, a coleta real também daria.
   */
  async agregarCaso(params: {
    turmaId: number;
    casoLegacyId: number;
    inicio: Date;
    fim: Date;
  }): Promise<{
    alunosTotal: number;
    alunosEngajados: number;
    concluidos: number;
    taxaConclusao: number;
    engajamento: number;
    etapas: { chave: string; label: string; alunos: number; porcentagem: number }[];
  }> {
    const { turmaId, casoLegacyId, inicio, fim } = params;

    const [{ total }] = await this.q<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM turmausuario WHERE tma_id = $1`,
      [turmaId],
    );
    const alunosTotal = Number(total);

    const eventos = await this.q<{ usuario_id: number; evento: string }>(
      `SELECT DISTINCT ce.usuario_id, ce.evento
         FROM caseevent ce
         JOIN turmausuario tu ON tu.usu_id = ce.usuario_id AND tu.tma_id = $1
        WHERE ce.caso_id = $2 AND ce.createdat BETWEEN $3 AND $4`,
      [turmaId, casoLegacyId, inicio, fim],
    );

    const porEvento = new Map<string, Set<number>>();
    const engajados = new Set<number>();
    for (const linha of eventos) {
      engajados.add(linha.usuario_id);
      const set = porEvento.get(linha.evento) ?? new Set<number>();
      set.add(linha.usuario_id);
      porEvento.set(linha.evento, set);
    }

    const contar = (nomes: string[]): number => {
      const conjunto = new Set<number>();
      for (const nome of nomes) {
        for (const id of porEvento.get(nome) ?? []) conjunto.add(id);
      }
      return conjunto.size;
    };
    const pct = (parte: number): number =>
      alunosTotal > 0 ? Math.round((100 * parte) / alunosTotal) : 0;

    const grupos = [
      { chave: "anamnese", label: "Anamnese", eventos: ["anamnese_play", "anamnese_end"] },
      { chave: "examefisico", label: "Exame físico", eventos: ["examefisico_play", "examefisico_end"] },
      { chave: "exames", label: "Exames", eventos: ["exame_play", "exame_end"] },
      { chave: "diagnostico", label: "Diagnóstico", eventos: ["diagnostico_end", "hipotese_end"] },
      { chave: "conduta", label: "Conduta", eventos: ["conduta_end"] },
    ];
    const concluidos = contar(["caso_end", "exit"]);

    return {
      alunosTotal,
      alunosEngajados: engajados.size,
      concluidos,
      taxaConclusao: pct(concluidos),
      engajamento: pct(engajados.size),
      etapas: grupos.map((g) => {
        const alunos = contar(g.eventos);
        return { chave: g.chave, label: g.label, alunos, porcentagem: pct(alunos) };
      }),
    };
  }

  /**
   * Remove apenas o que este seed criou.
   *
   * Ordem importa: eventos e vínculos antes dos usuários, porque as FKs
   * apontam para eles. `caseevent`/`casotime` são apagados **pelos alunos de
   * seed**, nunca por caso ou turma — assim execução real de gente real no
   * mesmo caso continua intacta.
   */
  async limparLegado(empId: number): Promise<{
    alunos: number;
    eventos: number;
    turmas: number;
  }> {
    const alunos = await this.q<{ id: number }>(
      `SELECT id FROM usuario WHERE external_id = $1`,
      [SEED_TAG],
    );
    const ids = alunos.map((a) => a.id);

    let eventos = 0;
    if (ids.length > 0) {
      const apagados = await this.q<{ id: number }>(
        `DELETE FROM caseevent WHERE usuario_id = ANY($1::int[]) RETURNING id`,
        [ids],
      );
      eventos = apagados.length;

      await this.q(`DELETE FROM casotime WHERE usuario_id = ANY($1::int[])`, [
        ids,
      ]);
      await this.q(`DELETE FROM turmausuario WHERE usu_id = ANY($1::int[])`, [
        ids,
      ]);
      await this.q(`DELETE FROM usuarioempresa WHERE usu_id = ANY($1::int[])`, [
        ids,
      ]);
      await this.q(`DELETE FROM usuario WHERE id = ANY($1::int[])`, [ids]);
    }

    // A turma sai por último e só se for de seed. `turmacurso` criado pelo
    // preparo do caso é removido junto para a FK não travar.
    const turmas = await this.q<{ id: number }>(
      `SELECT id FROM turma WHERE emp_id = $1 AND external_id = $2`,
      [empId, SEED_TAG],
    );
    if (turmas.length > 0) {
      const turmaIds = turmas.map((t) => t.id);
      await this.q(`DELETE FROM turmacurso WHERE tma_id = ANY($1::int[])`, [
        turmaIds,
      ]);
      await this.q(`DELETE FROM turmausuario WHERE tma_id = ANY($1::int[])`, [
        turmaIds,
      ]);
      await this.q(`DELETE FROM turma WHERE id = ANY($1::int[])`, [turmaIds]);
    }

    return { alunos: ids.length, eventos, turmas: turmas.length };
  }
}

function slug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
}
