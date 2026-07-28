import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export interface DesempenhoAlunoEnquete {
  email: string;
  nome: string | null;
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
   */
  async desempenhoPorAluno(
    pacotes: { packageId: string; nomeCampoId: string | null }[],
  ): Promise<DesempenhoAlunoEnquete[]> {
    if (!this.pool || pacotes.length === 0) return [];

    const packageIds = pacotes.map((p) => p.packageId);
    const camposNome = pacotes.map((p) => p.nomeCampoId);

    const result = await this.pool.query<{
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
      GROUP BY a.email, nome
      `,
      [packageIds, camposNome],
    );

    return result.rows.map((r) => ({
      email: r.email,
      nome: r.nome,
      total: Number(r.total),
      acertos: Number(r.acertos),
    }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
