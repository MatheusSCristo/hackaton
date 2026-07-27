import { Module } from "@nestjs/common";

import { AulasModule } from "../aulas/aulas.module";
import { CasoModule } from "../caso/caso.module";
import { EnqueteModule } from "../enquete/enquete.module";
import { MateriaisModule } from "../materiais/materiais.module";
import { PreparacaoController } from "./preparacao.controller";
import { PreparacaoService } from "./preparacao.service";

@Module({
  imports: [AulasModule, CasoModule, EnqueteModule, MateriaisModule],
  controllers: [PreparacaoController],
  providers: [PreparacaoService],
})
export class PreparacaoModule {}
