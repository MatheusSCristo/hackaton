import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { IS_PUBLIC_KEY } from "./public.decorator";
import { LegacyAuthService, LegacyTokenInfo } from "./legacy-auth.service";

export interface AuthenticatedRequest extends Request {
  legacyUser?: LegacyTokenInfo;
}

/**
 * Guard global: exige `X-Access-Token` e o valida contra o P360 legado.
 * Rotas marcadas com `@Public()` são liberadas (ex.: /api/health).
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly legacyAuth: LegacyAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header("X-Access-Token");
    const accessToken = Array.isArray(header) ? header[0] : header;

    if (!accessToken || accessToken.trim() === "") {
      throw new UnauthorizedException("X-Access-Token ausente");
    }

    const tokenInfo = await this.legacyAuth.validate(accessToken);
    if (!tokenInfo) {
      throw new UnauthorizedException("X-Access-Token inválido");
    }

    request.legacyUser = tokenInfo;
    return true;
  }
}
