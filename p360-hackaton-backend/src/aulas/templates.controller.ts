import { Controller, Get } from "@nestjs/common";

import { AULA_TEMPLATES } from "./bloco-tipos";
import type { AulaTemplate } from "./bloco-tipos";

/**
 * Templates de sessão de aula. São apenas ponto de partida: depois de
 * aplicados, o professor reordena/adiciona/remove blocos livremente.
 */
@Controller("aula-templates")
export class TemplatesController {
  @Get()
  list(): readonly AulaTemplate[] {
    return AULA_TEMPLATES;
  }
}
