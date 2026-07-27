import { Module } from "@nestjs/common";

import { AulasModule } from "../aulas/aulas.module";
import { EnqueteController } from "./enquete.controller";
import { EnqueteService } from "./enquete.service";
import { EnqueteIaService } from "./enquete-ia.service";
import { Poll360Service } from "./poll360.service";

@Module({
  imports: [AulasModule],
  controllers: [EnqueteController],
  providers: [EnqueteService, EnqueteIaService, Poll360Service],
  exports: [Poll360Service],
})
export class EnqueteModule {}
