import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";

import {
  isLlmConfigured,
  LLM_PROVIDER,
  LlmJsonSchema,
  LlmProvider,
} from "../llm/llm-provider.interface";

export interface GerarJsonOpts<T> {
  systemPrompt: string;
  userPrompt: string;
  /** Nome + schema da tool: é o que força a saída estruturada. */
  toolName: string;
  toolDescription: string;
  inputSchema: LlmJsonSchema;
  /** Validação do payload; falha dispara **uma** nova tentativa. */
  schema: ZodType<T>;
  maxTokens?: number;
}

/**
 * Gerador de JSON estruturado (Gemini com fallback Anthropic), compartilhado
 * por slides, simulado e resumo.
 *
 * A saída vem por **tool use forçado** na Anthropic e por **JSON mode** no
 * Gemini (ver `LlmProvider`/`GeminiProvider`). O que garante a qualidade aqui
 * é a **validação Zod + 1 retry semântico**, que protege contra saída
 * bem-formada mas fora do contrato, independente de qual provider respondeu.
 */
@Injectable()
export class IaJsonService {
  private readonly logger = new Logger(IaJsonService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  get enabled(): boolean {
    return isLlmConfigured(this.config);
  }

  async gerar<T>(opts: GerarJsonOpts<T>): Promise<T> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        "Geração por IA indisponível: configure GEMINI_API_KEY ou ANTHROPIC_API_KEY.",
      );
    }

    let ultimoErro = "";

    // Duas tentativas: a segunda recebe o motivo da recusa, o que costuma
    // resolver desvio de contrato (contagem, campo faltando).
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const bruto = await this.chamar(opts, ultimoErro);
      const validado = opts.schema.safeParse(bruto);

      if (validado.success) return validado.data;

      ultimoErro = validado.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "raiz"}: ${i.message}`)
        .join("; ");
      this.logger.warn(
        `Saída da IA reprovada (tentativa ${tentativa + 1}): ${ultimoErro}`,
      );
    }

    throw new UnprocessableEntityException(
      `A IA não produziu um resultado válido (${ultimoErro}). Tente gerar novamente.`,
    );
  }

  private async chamar<T>(
    opts: GerarJsonOpts<T>,
    erroAnterior: string,
  ): Promise<unknown> {
    const userPrompt = erroAnterior
      ? `${opts.userPrompt}\n\nA tentativa anterior foi rejeitada por: ${erroAnterior}. Corrija exatamente esses pontos.`
      : opts.userPrompt;

    return this.llmProvider.generateStructured({
      systemPrompt: opts.systemPrompt,
      userPrompt,
      toolName: opts.toolName,
      toolDescription: opts.toolDescription,
      inputSchema: opts.inputSchema,
      maxTokens: opts.maxTokens,
      label: opts.toolName,
    });
  }
}
