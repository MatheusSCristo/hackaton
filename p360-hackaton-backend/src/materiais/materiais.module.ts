import { Module } from "@nestjs/common";

import { AulasModule } from "../aulas/aulas.module";
import { SessaoModule } from "../sessao/sessao.module";
import { ContextoAulaService } from "./contexto-aula.service";
import { IaJsonService } from "./ia-json.service";
import {
  MateriaisAlunoController,
  MateriaisController,
  ResumoAlunoController,
  SimuladoAlunoController,
} from "./materiais.controller";
import { MateriaisService } from "./materiais.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { PptxRendererService } from "./pptx-renderer.service";
import { ResumoIaService } from "./resumo-ia.service";
import { SimuladoIaService } from "./simulado-ia.service";
import { SlidesIaService } from "./slides-ia.service";

@Module({
  imports: [AulasModule, SessaoModule],
  controllers: [
    MateriaisController,
    MateriaisAlunoController,
    SimuladoAlunoController,
    ResumoAlunoController,
  ],
  providers: [
    MateriaisService,
    ContextoAulaService,
    IaJsonService,
    SlidesIaService,
    SimuladoIaService,
    ResumoIaService,
    PptxRendererService,
    PdfRendererService,
  ],
  exports: [MateriaisService],
})
export class MateriaisModule {}
