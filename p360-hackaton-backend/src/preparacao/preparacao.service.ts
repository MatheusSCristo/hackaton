import { Injectable, Logger } from "@nestjs/common";

import { BlocosService } from "../aulas/blocos.service";
import { ehPosAula } from "../aulas/bloco-tipos";
import { CasoService } from "../caso/caso.service";
import { EnqueteService } from "../enquete/enquete.service";
import { MateriaisService } from "../materiais/materiais.service";
import type { BlocoDto } from "../aulas/dto/bloco.dto";

export interface PreparoDeBloco {
  blocoId: string;
  tipo: string;
  /** `pronto` = já estava; `preparado` = fizemos agora; `falhou` = ver `erro`. */
  status: "pronto" | "preparado" | "falhou";
  erro?: string;
}

export interface ResultadoPreparo {
  blocos: PreparoDeBloco[];
  /** Blocos que ficaram utilizáveis, prontos ou preparados agora. */
  prontos: number;
  falhas: number;
}

interface ContextoPreparo {
  aulaId: string;
  professorId: string;
  token: string;
  empId: number | undefined;
  professorLegacyId: number | undefined;
}

/**
 * Prepara a aula inteira de uma vez, para o professor não ter que gerar bloco
 * por bloco antes de apresentar.
 *
 * Duas garantias que fazem isso ser seguro de chamar a qualquer momento:
 *
 * - **Idempotente.** Cada tipo tem um marcador de "já preparado" no `output`
 *   (`apresentacao`, `cursoLegacyId`, `poll360PackageId`); se existe, pula. Isso
 *   importa de verdade na enquete: publicar duas vezes criaria pacotes
 *   duplicados no poll360, que não é idempotente.
 * - **Um bloco não derruba os outros.** Falha em um vira `status: "falhou"` no
 *   relatório e a preparação segue. O professor prefere entrar na aula com 2 de
 *   3 blocos prontos do que com um erro genérico e nada feito.
 *
 * Ordem sequencial de propósito: os blocos posteriores usam o resultado dos
 * anteriores (a enquete pode focar nos pontos fracos do caso), e chamadas de IA
 * em paralelo só somariam pressão de rate limit sem ganho perceptível aqui.
 */
@Injectable()
export class PreparacaoService {
  private readonly logger = new Logger(PreparacaoService.name);

  constructor(
    private readonly blocos: BlocosService,
    private readonly materiais: MateriaisService,
    private readonly caso: CasoService,
    private readonly enquete: EnqueteService,
  ) {}

  async prepararAula(ctx: ContextoPreparo): Promise<ResultadoPreparo> {
    const todos = await this.blocos.list(ctx.aulaId, ctx.professorId);

    // Só a sequência ao vivo. Pós-aula (simulado/resumo) é material de casa: o
    // professor decide o que disponibilizar, e gerar tudo aqui gastaria IA à toa.
    const daSessao = todos.filter((b) => !ehPosAula(b.tipo));

    const relatorio: PreparoDeBloco[] = [];
    for (const bloco of daSessao) {
      relatorio.push(await this.prepararBloco(bloco, ctx));
    }

    return {
      blocos: relatorio,
      prontos: relatorio.filter((r) => r.status !== "falhou").length,
      falhas: relatorio.filter((r) => r.status === "falhou").length,
    };
  }

  private async prepararBloco(
    bloco: BlocoDto,
    ctx: ContextoPreparo,
  ): Promise<PreparoDeBloco> {
    const base = { blocoId: bloco.id, tipo: bloco.tipo };
    const output = (bloco.output ?? {}) as Record<string, unknown>;

    try {
      switch (bloco.tipo) {
        case "slides": {
          if (output.apresentacao) return { ...base, status: "pronto" };
          await this.materiais.gerar(ctx.aulaId, bloco.id, ctx.professorId);
          return { ...base, status: "preparado" };
        }

        case "caso": {
          if (output.cursoLegacyId) return { ...base, status: "pronto" };
          await this.caso.preparar(
            ctx.aulaId,
            bloco.id,
            ctx.professorId,
            ctx.empId,
            ctx.professorLegacyId,
          );
          return { ...base, status: "preparado" };
        }

        case "enquete": {
          if (output.poll360PackageId) return { ...base, status: "pronto" };

          // Gerar e publicar são passos distintos: a enquete pode já ter
          // rascunho revisado pelo professor, e regerar apagaria o trabalho dele.
          const temPerguntas =
            Array.isArray(output.perguntas) && output.perguntas.length > 0;
          if (!temPerguntas) {
            await this.enquete.gerar(
              ctx.aulaId,
              bloco.id,
              ctx.professorId,
              {},
            );
          }
          await this.enquete.publicar(
            ctx.aulaId,
            bloco.id,
            ctx.professorId,
            ctx.token,
            ctx.empId,
          );
          return { ...base, status: "preparado" };
        }

        default:
          // `reforco` e o que vier depois: nada a preparar ainda.
          return { ...base, status: "pronto" };
      }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      this.logger.warn(
        `Preparo do bloco ${bloco.id} (${bloco.tipo}) falhou: ${mensagem}`,
      );
      return { ...base, status: "falhou", erro: mensagem };
    }
  }
}
