import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedRequest } from "./access-token.guard";

/**
 * Injeta o `X-Access-Token` cru da requisição.
 *
 * Necessário porque alguns serviços externos (poll360, no monolith) autenticam
 * com o **mesmo token legado** repassado como `x-auth-token` + `x-auth-source:
 * legacy` — ou seja, precisamos do token em si, não só do usuário resolvido
 * (`@LegacyUser`).
 */
export const LegacyToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header("X-Access-Token");
    const token = Array.isArray(header) ? header[0] : header;
    return token?.trim() ? token : undefined;
  },
);
