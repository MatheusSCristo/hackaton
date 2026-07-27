import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { SessaoController } from "./sessao.controller";
import { SessaoGateway } from "./sessao.gateway";
import { SessaoService } from "./sessao.service";

@Module({
  imports: [AuthModule],
  controllers: [SessaoController],
  providers: [SessaoService, SessaoGateway],
  exports: [SessaoService, SessaoGateway],
})
export class SessaoModule {}
