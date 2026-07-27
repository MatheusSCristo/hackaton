import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedRequest } from "./access-token.guard";
import type { LegacyTokenInfo } from "./legacy-auth.service";

/**
 * Injeta o usuário legado validado pelo AccessTokenGuard
 * (`request.legacyUser`). Rotas que usam este decorator já são protegidas
 * pelo guard global, então o valor está presente (exceto em rotas @Public).
 */
export const LegacyUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): LegacyTokenInfo | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.legacyUser;
  },
);
