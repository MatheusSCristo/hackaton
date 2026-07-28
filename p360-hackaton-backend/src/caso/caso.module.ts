import { Module } from "@nestjs/common";

import { AulasModule } from "../aulas/aulas.module";
import { SessaoModule } from "../sessao/sessao.module";
import {
  CasoAlunoController,
  CasoController,
  CasoTurmasController,
} from "./caso.controller";
import { CasoService } from "./caso.service";
import { CasoColetaService } from "./caso-coleta.service";
import { CasoDiagnosticoService } from "./caso-diagnostico.service";
import { CursoWrapperService } from "./curso-wrapper.service";

@Module({
  imports: [AulasModule, SessaoModule],
  controllers: [CasoController, CasoAlunoController, CasoTurmasController],
  providers: [
    CasoService,
    CasoColetaService,
    CasoDiagnosticoService,
    CursoWrapperService,
  ],
})
export class CasoModule {}
