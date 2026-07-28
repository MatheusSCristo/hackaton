import { Controller, Get } from "@nestjs/common";

import { LegacyUser } from "../auth/legacy-user.decorator";
import { requireProfessorId } from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import { MetricasService } from "./metricas.service";
import type { MetricasDetalhadas } from "./metricas.service";

@Controller("metricas")
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  /** Tela dedicada de métricas — desempenho real por questão/aula/aluno. */
  @Get()
  async detalhado(
    @LegacyUser() user: LegacyTokenInfo | undefined,
  ): Promise<MetricasDetalhadas> {
    return this.metricas.detalhado(requireProfessorId(user));
  }
}
