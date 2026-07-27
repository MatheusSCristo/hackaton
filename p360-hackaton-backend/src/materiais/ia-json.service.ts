import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

const DEFAULT_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 8000;

export interface GerarJsonOpts<T> {
  systemPrompt: string;
  userPrompt: string;
  /** Nome + schema da tool: é o que força a saída estruturada. */
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool["input_schema"];
  /** Validação do payload; falha dispara **uma** nova tentativa. */
  schema: ZodType<T>;
  maxTokens?: number;
}

/**
 * Gerador de JSON estruturado com Claude, compartilhado por slides, simulado e
 * resumo.
 *
 * Diferença deliberada em relação ao projeto de origem (que usava JSON mode +
 * parser tolerante): aqui a saída vem por **tool use forçado**, o mesmo padrão
 * já usado pela busca semântica e pela enquete. Não há parsing de texto para dar
 * errado. O que foi portado do original é a **validação Zod + 1 retry
 * semântico**, que protege contra saída bem-formada mas fora do contrato.
 */
@Injectable()
export class IaJsonService {
  private readonly logger = new Logger(IaJsonService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("ANTHROPIC_API_KEY");
    this.model = config.get<string>("ANTHROPIC_MODEL") || DEFAULT_MODEL;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        "ANTHROPIC_API_KEY ausente — geração de materiais indisponível (503).",
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async gerar<T>(opts: GerarJsonOpts<T>): Promise<T> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "Geração por IA indisponível: configure ANTHROPIC_API_KEY.",
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
    const client = this.client as Anthropic;
    const tool: Anthropic.Tool = {
      name: opts.toolName,
      description: opts.toolDescription,
      input_schema: opts.inputSchema,
    };

    const userPrompt = erroAnterior
      ? `${opts.userPrompt}\n\nA tentativa anterior foi rejeitada por: ${erroAnterior}. Corrija exatamente esses pontos.`
      : opts.userPrompt;

    const response = await client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      system: opts.systemPrompt,
      tools: [tool],
      tool_choice: { type: "tool", name: opts.toolName },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === opts.toolName,
    );
    return toolUse?.input ?? {};
  }
}
