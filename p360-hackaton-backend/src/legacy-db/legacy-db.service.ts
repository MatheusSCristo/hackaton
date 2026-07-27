import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool, type QueryResultRow } from "pg";

/**
 * Conexão **read-only** ao PostgreSQL legado do P360 (banco `avp`), usada
 * para ler o acervo de casos clínicos. Espelha o padrão do
 * p360-cases-backend, que abre uma conexão crua ao mesmo banco.
 *
 * O Prisma do projeto aponta para o banco próprio do hackaton
 * (`DATABASE_URL`) e só suporta um datasource — por isso a leitura do
 * legado usa `pg` diretamente.
 *
 * Config via env `LEGACY_PG*`; cada uma cai para o padrão do banco `avp`.
 * `LEGACY_PGHOST_READ`, quando presente, prefere a réplica de leitura.
 * Sem host/senha configurados, qualquer consulta lança 503.
 */
@Injectable()
export class LegacyDbService implements OnModuleDestroy {
  private readonly logger = new Logger(LegacyDbService.name);
  private readonly pool: Pool | null;

  constructor(config: ConfigService) {
    const host =
      config.get<string>("LEGACY_PGHOST_READ") ||
      config.get<string>("LEGACY_PGHOST");
    const password = config.get<string>("LEGACY_PGPASSWORD");

    if (!host || !password) {
      this.logger.warn(
        "LEGACY_PGHOST/LEGACY_PGPASSWORD ausentes — busca de casos indisponível (503).",
      );
      this.pool = null;
      return;
    }

    this.pool = new Pool({
      host,
      port: Number(config.get<string>("LEGACY_PGPORT") ?? 5432),
      user: config.get<string>("LEGACY_PGUSER") ?? "postgres",
      password,
      database: config.get<string>("LEGACY_PGDATABASE") ?? "avp",
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Sinaliza intenção read-only à sessão.
      options: "-c default_transaction_read_only=on",
    });

    this.pool.on("error", (err) =>
      this.logger.error(`Erro no pool do banco legado: ${err.message}`),
    );
  }

  async query<T extends QueryResultRow>(
    text: string,
    params: ReadonlyArray<unknown> = [],
  ): Promise<T[]> {
    if (!this.pool) {
      throw new ServiceUnavailableException(
        "Conexão com o banco legado (avp) não configurada.",
      );
    }
    const result = await this.pool.query<T>(text, params as unknown[]);
    return result.rows;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
