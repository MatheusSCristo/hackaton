import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

/**
 * Formato (parcial) do payload de /users/get-token-info no P360 legado.
 *
 * ⚠️ O endpoint devolve o **AccessToken** com o usuário aninhado — em
 * `usuario.js`: `token.__data.user = user; fn(null, token)`. Portanto **`id` é a
 * string do TOKEN**, e o id do usuário está em `userId` / `user.id`.
 * Use os helpers de `legacy-user.util.ts` em vez de ler estes campos direto.
 *
 * Token inválido devolve `{ status: false }`.
 */
export interface LegacyTokenInfo {
  /** ⚠️ String do token — NÃO é o id do usuário. */
  id?: number | string;
  /** Id do usuário no legado (`usuario.id`). */
  userId?: number | string;
  /** Empresa do usuário — usado para escopar a busca de casos ao acervo dela. */
  emp_id?: number;
  /** Perfil do usuário (5 = Administrador, 6 = Professor). */
  pusu_id?: number;
  /** Usuário aninhado pelo legado. */
  user?: unknown;
  status?: boolean;
  [key: string]: unknown;
}

/**
 * Valida o `X-Access-Token` (token de sessão legado repassado pelo
 * host avp-empresas) contra a API HTTP do P360 legado. Espelha o que o
 * p360-cases-backend faz em /api/case-attempts/*.
 */
@Injectable()
export class LegacyAuthService {
  private readonly logger = new Logger(LegacyAuthService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      baseURL: this.config.get<string>("LEGACY_API_BASE_URL"),
      timeout: 5000,
    });
  }

  async validate(accessToken: string): Promise<LegacyTokenInfo | null> {
    try {
      // Contrato do legado: POST com o token no body E no header (mesmo
      // client usado pelo p360-cases-backend). Token inválido devolve
      // 200 com `{ status: false }`.
      const { data } = await this.http.post<LegacyTokenInfo>(
        "/users/get-token-info",
        { token: accessToken },
        { headers: { "X-Access-Token": accessToken } },
      );
      if (!data || data.status === false) return null;
      return data;
    } catch (error) {
      this.logger.debug(
        `Falha ao validar X-Access-Token no legado: ${String(error)}`,
      );
      return null;
    }
  }
}
