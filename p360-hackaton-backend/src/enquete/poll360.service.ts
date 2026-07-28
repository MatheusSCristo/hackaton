import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError, type AxiosInstance } from "axios";

import type { PerguntaEnquete } from "./enquete-ia.service";

const API_PREFIX = "/api/v1/poll360";
/** Rótulo do campo que o aluno preenche antes de votar. */
const CAMPO_NOME = "Nome";
const PUBLIC_API_PREFIX = "/api/v1/public/poll360";

/** Nome do campo customizado usado para pedir o nome do aluno (não há campo nativo no poll360). */
export const NOME_CAMPO_CUSTOM = "Nome";

export interface PacoteCriado {
  packageId: string;
  pollIds: string[];
  /**
   * Id do campo customizado "Nome" (para ler o `custom_data` do attendee
   * depois, na métrica) — o poll360 **ignora** qualquer `id` enviado na
   * criação e gera o dele próprio, então precisa ser lido de volta na
   * resposta em vez de assumido.
   */
  nomeCampoId: string | null;
}

export interface SessaoEnquete {
  accessPin: string;
  joinUrl: string;
}

/**
 * Cliente REST do **poll360** (módulo de enquete do `p360-monolith`).
 *
 * O hackaton só **cria o conteúdo e abre a sessão**; a votação ao vivo
 * (PIN/QR, resultados) continua rodando no próprio poll360, que já tem o
 * realtime (`/ws/poll360`, Redis). Não duplicamos nada disso aqui.
 *
 * Auth: repassa o token legado do professor como o poll360 espera —
 * `x-auth-token` + `x-auth-source: legacy`.
 */
@Injectable()
export class Poll360Service {
  private readonly logger = new Logger(Poll360Service.name);
  private readonly http: AxiosInstance | null;
  private readonly publicUrl: string | null;

  constructor(config: ConfigService) {
    const baseUrl =
      config.get<string>("POLL360_API_URL") ||
      config.get<string>("MONOLITH_BACKEND_URL");
    this.publicUrl = config.get<string>("POLL360_PUBLIC_URL") ?? null;

    if (!baseUrl) {
      this.logger.warn(
        "MONOLITH_BACKEND_URL/POLL360_API_URL ausente — publicação de enquete indisponível (503).",
      );
      this.http = null;
      return;
    }

    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ""),
      timeout: 15_000,
    });
  }

  get enabled(): boolean {
    return this.http !== null;
  }

  /**
   * Cria um pacote e uma enquete por pergunta, com suas alternativas.
   * O poll360 modela `Package (1) → Poll (N) → PollOption (N)`.
   */
  async criarPacote(
    token: string,
    empId: number,
    packageName: string,
    perguntas: PerguntaEnquete[],
  ): Promise<PacoteCriado> {
    const http = this.require();

    const pacote = await this.post<unknown>(
      http,
      token,
      `${API_PREFIX}/packages`,
      {
        // `companyId` é obrigatório e vem como STRING no DTO do poll360.
        companyId: String(empId),
        packageName,
        // Sem "nome" nativo no poll360 — pedimos via campo customizado, e
        // e-mail via flag padrão. Isso faz o próprio poll360 mostrar a tela
        // de identificação (nome + e-mail) antes do aluno responder, sem
        // precisar de nada extra no nosso frontend.
        requireLogin: true,
        requireEmail: true,
        requireCrm: false,
        requireProfession: false,
        // Um campo personalizado obrigatório de nome, e só ele.
        //
        // Dois motivos. O professor precisa saber QUEM respondeu — sem nenhum
        // campo o respondente do poll360 é anônimo e a enquete não diz nada
        // sobre a turma. E, do lado do aluno, é o que faz o survey mostrar a
        // tela de cadastro: sem campo nenhum ela é pulada automaticamente
        // (`hasFields` no `attendeeProfile`), e ele entra sem se identificar.
        //
        // CRM/e-mail/profissão ficam de fora de propósito: em sala de aula cada
        // campo extra é tempo de projetor parado.
        customFieldsSchema: [{ field: CAMPO_NOME, status: true }],
      },
    );

    const corpoPacote = unwrap(pacote);
    const packageId = extractId(pacote);
    if (!packageId) {
      throw new BadGatewayException(
        "poll360 não retornou o id do pacote criado.",
      );
    }
    // O poll360 IGNORA o `id` que enviamos no campo customizado e gera o dele
    // próprio — só dá pra saber qual é lendo de volta na resposta.
    const nomeCampoId = extrairNomeCampoId(corpoPacote);

    const pollIds: string[] = [];
    for (const [index, pergunta] of perguntas.entries()) {
      const poll = await this.post<{ id?: string }>(
        http,
        token,
        `${API_PREFIX}/packages/${packageId}/polls`,
        {
          title: tituloCurto(pergunta.enunciado),
          questionText: pergunta.enunciado,
          responseFormat: "UNIQUE",
          displayOrder: index,
        },
      );

      const pollId = extractId(poll);
      if (!pollId) {
        throw new BadGatewayException(
          "poll360 não retornou o id da enquete criada.",
        );
      }
      pollIds.push(pollId);

      for (const [ordem, opcao] of pergunta.opcoes.entries()) {
        await this.post(
          http,
          token,
          `${API_PREFIX}/packages/${packageId}/polls/${pollId}/options`,
          {
            optionText: opcao.texto,
            justification: opcao.justificativa,
            isCorrect: opcao.correta,
            gamificationPoints: opcao.pontos,
            displayOrder: ordem,
          },
        );
      }
    }

    return { packageId, pollIds, nomeCampoId };
  }

  /** Abre a sessão ao vivo: o poll360 gera o PIN de entrada dos alunos. */
  async iniciarSessao(
    token: string,
    packageId: string,
    pollId: string,
  ): Promise<SessaoEnquete> {
    const http = this.require();

    const data = await this.post<unknown>(
      http,
      token,
      `${API_PREFIX}/sessions/start`,
      { pollId, packageId },
    );

    // Mesmo envelope `{ success, row }` dos outros endpoints.
    const corpo = unwrap(data);
    const accessPin =
      typeof corpo?.accessPin === "string"
        ? corpo.accessPin
        : typeof corpo?.pin === "string"
          ? corpo.pin
          : undefined;
    if (!accessPin) {
      throw new BadGatewayException("poll360 não retornou o PIN da sessão.");
    }

    return { accessPin, joinUrl: this.joinUrl(accessPin) };
  }

  /**
   * Pré-cria o respondente já vinculado ao aluno do P360.
   *
   * Sem isso o respondente do poll360 é anônimo e não haveria como cruzar a
   * resposta da enquete com o desempenho do mesmo aluno no caso.
   *
   * ⚠️ Depende de o poll360 aceitar um `attendeeId` pré-existente na entrada da
   * sala — a validar antes de prometer o cruzamento por aluno.
   */
  async criarAttendee(
    accessPin: string,
    usuarioId: string,
  ): Promise<string | null> {
    const http = this.require();

    try {
      const data = await this.post<{ id?: string }>(
        http,
        null,
        `${PUBLIC_API_PREFIX}/attendees`,
        {
          pin: accessPin,
          customData: [{ id: "p360_usu_id", value: usuarioId }],
        },
      );
      return extractId(data);
    } catch (error) {
      // Identidade é um "nice to have": se falhar, a enquete segue anônima.
      this.logger.warn(
        `Não foi possível pré-criar o attendee no poll360: ${describe(error)}`,
      );
      return null;
    }
  }

  /**
   * URL pública de entrada do aluno (survey-frontend) — `/sessions/:pin` entra
   * direto na votação, sem pedir pro aluno digitar o código de novo (diferente
   * de `/join?pin=`, que ainda mostra uma tela intermediária de entrada).
   */
  joinUrl(accessPin: string): string {
    const base = (this.publicUrl ?? "").replace(/\/+$/, "");
    return base ? `${base}/sessions/${encodeURIComponent(accessPin)}` : "";
  }

  private require(): AxiosInstance {
    if (!this.http) {
      throw new ServiceUnavailableException(
        "Integração com o poll360 não configurada (MONOLITH_BACKEND_URL).",
      );
    }
    return this.http;
  }

  private async post<T>(
    http: AxiosInstance,
    token: string | null,
    url: string,
    body: unknown,
  ): Promise<T> {
    try {
      const response = await http.post<T>(url, body, {
        headers: token
          ? { "x-auth-token": token, "x-auth-source": "legacy" }
          : undefined,
      });
      return response.data;
    } catch (error) {
      const detalhe = describe(error);
      this.logger.error(`POST ${url} falhou: ${detalhe}`);

      // Propaga o motivo real: erro de validação (422) ou de auth (401) do
      // poll360 mascarado como "falha de comunicação" é impossível de depurar.
      throw new BadGatewayException(
        `poll360 recusou ${url}: ${mensagemDoErro(error) ?? detalhe}`,
      );
    }
  }
}

/** Extrai a mensagem que o poll360 devolveu (string ou lista de validações). */
function mensagemDoErro(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const data = error.response?.data as { message?: unknown } | undefined;
  const message = data?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join("; ");
  return null;
}

/**
 * O poll360 responde `{ success: true, row: { id, ... } }`. Aceitamos também
 * `{ data: {...} }` e o objeto puro, porque o envelope varia entre endpoints.
 */
function extractId(payload: unknown): string | null {
  const corpo = unwrap(payload);
  const id = corpo?.id;
  return typeof id === "string" && id ? id : null;
}

/** Tira o envelope `{ success, row }` (ou `{ data }`) e devolve o objeto útil. */
function unwrap(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;

  for (const chave of ["row", "data"]) {
    const envelope = obj[chave];
    if (typeof envelope === "object" && envelope !== null) {
      return envelope as Record<string, unknown>;
    }
  }
  return obj;
}

/** Acha, na resposta da criação do pacote, o id gerado pro campo "Nome". */
function extrairNomeCampoId(corpo: Record<string, unknown> | null): string | null {
  const schema = corpo?.customFieldsSchema;
  if (!Array.isArray(schema)) return null;
  const campo = schema.find(
    (item): item is { id?: string; field?: string } =>
      typeof item === "object" &&
      item !== null &&
      (item as { field?: unknown }).field === NOME_CAMPO_CUSTOM,
  );
  const id = campo?.id;
  return typeof id === "string" && id ? id : null;
}

function tituloCurto(enunciado: string): string {
  const limpo = enunciado.trim();
  return limpo.length <= 80 ? limpo : `${limpo.slice(0, 77)}...`;
}

function describe(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    return `${status ?? "sem status"} ${data ? JSON.stringify(data).slice(0, 200) : axiosError.message}`;
  }
  return String(error);
}
