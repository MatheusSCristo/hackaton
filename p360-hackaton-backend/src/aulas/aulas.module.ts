import { Module } from "@nestjs/common";

import { CasosModule } from "../casos/casos.module";
import { AulasController } from "./aulas.controller";
import { AulasService } from "./aulas.service";
import { AulasInsightsService } from "./aulas-insights.service";
import { BlocosService } from "./blocos.service";
import { TemplatesController } from "./templates.controller";

@Module({
  imports: [CasosModule],
  controllers: [AulasController, TemplatesController],
  providers: [AulasService, AulasInsightsService, BlocosService],
  exports: [BlocosService],
})
export class AulasModule {}
