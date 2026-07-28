import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export interface DesempenhoAlunoEnquete {
  /** Pacote (aula/bloco de enquete) a que este resultado pertence. */
  packageId: string;
  email: string;
  nome: string | null;
  total: number;
  acertos: number;
}

export interface ResultadoPoll {
  packageId: string;
  pollId: string;
  total: number;
  acertos: number;
}

/**
 * Conexão **read-only** ao PostgreSQL do poll360 (módulo de enquete do
 * `p360-monolith`), usada só pra ler `poll.vote`/`poll.attendee` e calcular
 * desempenho por aluno nas enquetes.
 *
 * O poll360 não expõe nenhum endpoint HTTP com voto individual por
 * respondente (só agregado por opção, via Redis) — o voto-por-pessoa só
 * existe nessas tabelas. Espelha o mesmo padrão do `LegacyDbService` (banco
 * `avp`): conexão crua via `pg`, porque o Prisma deste projeto só suporta o
 * datasource próprio do hackaton.
 *
 * Config via env `POLL360_PG*`. Sem host/senha configurados, o desempenho
 * por aluno na enquete simplesmente vem vazio (feature "nice to have", não
 * quebra o resto das métricas).
 */
@Injectable()
export class Poll360DbService implements OnModuleDestroy {
  private readonly logger = new Logger(Poll360DbService.name);
  private readonly pool: Pool | null;

  constructor(config: ConfigService) {
    const host = config.get<string>("POLL360_PGHOST");
    const password = config.get<string>("POLL360_PGPASSWORD");

    if (!host || !password) {
      this.logger.warn(
        "POLL360_PGHOST/POLL360_PGPASSWORD ausentes — desempenho por aluno na enquete indisponível.",
      );
      this.pool = null;
      return;
    }

    this.pool = new Pool({
      host,
      port: Number(config.get<string>("POLL360_PGPORT") ?? 5432),
      user: config.get<string>("POLL360_PGUSER") ?? "postgres",
      password,
      database: config.get<string>("POLL360_PGDATABASE") ?? "p360-monolith",
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Sinaliza intenção read-only à sessão.
      options: "-c default_transaction_read_only=on",
    });

    this.pool.on("error", (err) =>
      this.logger.error(`Erro no pool do banco poll360: ${err.message}`),
    );
  }

  get enabled(): boolean {
    return this.pool !== null;
  }

  /**
   * Desempenho por aluno, cruzando voto → opção (`is_correct`) → attendee
   * (e-mail + nome). O nome fica no `custom_data` do attendee, guardado sob
   * um id que o **poll360 gera sozinho** ao criar o pacote (ignora qualquer
   * id que a gente sugira) — por isso cada pacote entra aqui com o id do seu
   * próprio campo "Nome" (`poll360NomeCampoId` no output do bloco), em vez de
   * um id fixo assumido.
   *
   * Filtra por `packageId` (não por `accessPin`): o PIN de uma sessão é
   * reaproveitável/reciclável no poll360 (já vimos o mesmo PIN usado em
   * pacotes bem diferentes ao longo do tempo) — `packageId` é o que
   * identifica sem ambiguidade o pacote que ESTE bloco criou.
   *
   * Devolve uma linha por (pacote, aluno) — não já agregado por aluno —
   * pra quem chama poder tanto agrupar por aula (1 pacote) quanto agregar
   * por aluno através de várias aulas, conforme a necessidade.
   */
  async desempenhoPorAluno(
    pacotes: { packageId: string; nomeCampoId: string | null }[],
  ): Promise<DesempenhoAlunoEnquete[]> {
    if (!this.pool || pacotes.length === 0) return [];

    const packageIds = pacotes.map((p) => p.packageId);
    const camposNome = pacotes.map((p) => p.nomeCampoId);

    const result = await this.pool.query<{
      package_id: string;
      email: string;
      nome: string | null;
      total: string;
      acertos: string;
    }>(
      `
      WITH pacotes AS (
        SELECT unnest($1::text[]) AS package_id, unnest($2::text[]) AS nome_campo_id
      )
      SELECT
        pk.package_id AS package_id,
        a.email AS email,
        (
          SELECT elem->>'value'
          FROM jsonb_array_elements(COALESCE(a.custom_data, '[]'::jsonb)) elem
          WHERE elem->>'id' = pk.nome_campo_id
        ) AS nome,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE po.is_correct)::int AS acertos
      FROM poll.vote v
      JOIN poll.attendee a ON a.id = v.attendee_id
      JOIN poll.poll pl ON pl.id = v.poll_id
      JOIN pacotes pk ON pk.package_id = pl.package_id::text
      LEFT JOIN poll.poll_option po
        ON po.poll_id = v.poll_id
       AND po.id::text = ANY (
             ARRAY(SELECT jsonb_array_elements_text(COALESCE(v.options, '[]'::jsonb)))
           )
      WHERE v.deleted_at IS NULL
        AND a.email IS NOT NULL
      GROUP BY pk.package_id, a.email, nome
      `,
      [packageIds, camposNome],
    );

    return result.rows.map((r) => ({
      packageId: r.package_id,
      email: r.email,
      nome: r.nome,
      total: Number(r.total),
      acertos: Number(r.acertos),
    }));
  }

  /**
   * Total de votos e acertos por pergunta (poll) de cada pacote — substitui
   * o snapshot agregado que a gente registrava via `EnqueteResultado` (que
   * só capturava o resultado no instante em que o professor encerrava a
   * questão, perdendo voto de quem respondia antes/depois).
   *
   * Filtra por `packageId`, NÃO pelos `pollIds` que a gente guardou no
   * output do bloco: já vimos pacote com pergunta a mais votada do que a
   * gente tinha registrado (republicação/reedição gera poll novo no mesmo
   * pacote sem atualizar o bloco) — isso fazia o "X questões" do "Por aula"
   * não bater com o total usado no cálculo por aluno (`desempenhoPorAluno`,
   * que também é por `packageId`). Buscando aqui pelo pacote inteiro, as duas
   * contas sempre casam.
   */
  async resultadosPorPacote(packageIds: string[]): Promise<ResultadoPoll[]> {
    if (!this.pool || packageIds.length === 0) return [];

    const result = await this.pool.query<{
      package_id: string;
      poll_id: string;
      total: string;
      acertos: string;
    }>(
      `
      SELECT
        pl.package_id::text AS package_id,
        v.poll_id::text AS poll_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE po.is_correct)::int AS acertos
      FROM poll.vote v
      JOIN poll.poll pl ON pl.id = v.poll_id
      LEFT JOIN poll.poll_option po
        ON po.poll_id = v.poll_id
       AND po.id::text = ANY (
             ARRAY(SELECT jsonb_array_elements_text(COALESCE(v.options, '[]'::jsonb)))
           )
      WHERE pl.package_id::text = ANY($1::text[])
        AND v.deleted_at IS NULL
      GROUP BY pl.package_id, v.poll_id
      `,
      [packageIds],
    );

    return result.rows.map((r) => ({
      packageId: r.package_id,
      pollId: r.poll_id,
      total: Number(r.total),
      acertos: Number(r.acertos),
    }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
