import { Module } from "@nestjs/common";

import { AulasController } from "./aulas.controller";
import { AulasService } from "./aulas.service";
import { AulasInsightsService } from "./aulas-insights.service";
import { BlocosService } from "./blocos.service";
import { TemplatesController } from "./templates.controller";

@Module({
  controllers: [AulasController, TemplatesController],
  providers: [AulasService, AulasInsightsService, BlocosService],
  exports: [BlocosService],
})
export class AulasModule {}
