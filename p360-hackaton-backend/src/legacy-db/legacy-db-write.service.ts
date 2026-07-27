import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Conexão **read-write** ao PostgreSQL legado (`avp`), usada apenas para
 * preparar/liberar o caso da aula (curso-wrapper, atribuição à turma,
 * matrícula).
 *
 * Separada do `LegacyDbService` de propósito: aquele é read-only
 * (`default_transaction_read_only=on`) e deve continuar assim. Aqui:
 *
 * - credencial própria (`LEGACY_PGUSER_WRITE`/`LEGACY_PGPASSWORD_WRITE`), para
 *   poder limitar privilégios no banco;
 * - pool pequeno e transações curtas;
 * - **sempre** queries parametrizadas.
 *
 * Atenção: escrever direto contorna os hooks do LoopBack — `createdat`/
 * `updatedat` são NOT NULL sem default e precisam ser setados por nós.
 */
@Injectable()
export class LegacyDbWriteService implements OnModuleDestroy {
  private readonly logger = new Logger(LegacyDbWriteService.name);
  private readonly pool: Pool | null;

  constructor(config: ConfigService) {
    const host = config.get<string>("LEGACY_PGHOST");
    const password =
      config.get<string>("LEGACY_PGPASSWORD_WRITE") ||
      config.get<string>("LEGACY_PGPASSWORD");

    if (!host || !password) {
      this.logger.warn(
        "LEGACY_PGHOST/senha ausentes — preparação do caso indisponível (503).",
      );
      this.pool = null;
      return;
    }

    this.pool = new Pool({
      host,
      port: Number(config.get<string>("LEGACY_PGPORT") ?? 5432),
      user:
        config.get<string>("LEGACY_PGUSER_WRITE") ||
        config.get<string>("LEGACY_PGUSER") ||
        "postgres",
      password,
      database: config.get<string>("LEGACY_PGDATABASE") ?? "avp",
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on("error", (err) =>
      this.logger.error(`Erro no pool de escrita do legado: ${err.message}`),
    );
  }

  get enabled(): boolean {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow>(
    text: string,
    params: ReadonlyArray<unknown> = [],
  ): Promise<T[]> {
    const pool = this.require();
    const result = await pool.query<T>(text, params as unknown[]);
    return result.rows;
  }

  /** Executa em transação; faz rollback em qualquer erro. */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.require();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const resultado = await fn(client);
      await client.query("COMMIT");
      return resultado;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private require(): Pool {
    if (!this.pool) {
      throw new ServiceUnavailableException(
        "Escrita no banco legado (avp) não configurada.",
      );
    }
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
