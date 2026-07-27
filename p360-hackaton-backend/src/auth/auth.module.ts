import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { AccessTokenGuard } from "./access-token.guard";
import { LegacyAuthService } from "./legacy-auth.service";

@Module({
  providers: [
    LegacyAuthService,
    // Guard global — protege toda rota que não seja @Public().
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
  exports: [LegacyAuthService],
})
export class AuthModule {}
