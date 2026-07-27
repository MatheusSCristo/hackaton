import {
  Controller,
  Param,
  Post,
  UnauthorizedException,
} from "@nestjs/common";

import { LegacyToken } from "../auth/legacy-token.decorator";
import { LegacyUser } from "../auth/legacy-user.decorator";
import {
  legacyEmpId,
  legacyUsuarioId,
  requireProfessorId,
} from "../auth/legacy-user.util";
import type { LegacyTokenInfo } from "../auth/legacy-auth.service";
import { PreparacaoService } from "./preparacao.service";
import type { ResultadoPreparo } from "./preparacao.service";

/**
 * "Preparar a aula" — um clique que deixa a sequência ao vivo pronta para
 * apresentar: slides gerados, caso com wrapper criado, enquete publicada.
 *
 * Existe para o professor não precisar percorrer bloco por bloco antes de
 * projetar. É idempotente, então dá para chamar de novo sem medo.
 */
@Controller("aulas/:aulaId/preparar")
export class PreparacaoController {
  constructor(private readonly preparacao: PreparacaoService) {}

  @Post()
  async preparar(
    @Param("aulaId") aulaId: string,
    @LegacyUser() user: LegacyTokenInfo | undefined,
    @LegacyToken() token: string | undefined,
  ): Promise<ResultadoPreparo> {
    if (!token) {
      throw new UnauthorizedException("X-Access-Token ausente.");
    }
    return this.preparacao.prepararAula({
      aulaId,
      professorId: requireProfessorId(user),
      token,
      empId: legacyEmpId(user),
      professorLegacyId: legacyUsuarioId(user),
    });
  }
}
