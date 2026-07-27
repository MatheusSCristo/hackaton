import { Module } from "@nestjs/common";

import { CasosController } from "./casos.controller";
import { CasosService } from "./casos.service";
import { SemanticSearchService } from "./semantic-search.service";

@Module({
  controllers: [CasosController],
  providers: [CasosService, SemanticSearchService],
  exports: [CasosService],
})
export class CasosModule {}
