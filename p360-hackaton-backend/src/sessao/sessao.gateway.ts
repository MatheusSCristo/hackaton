import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { SessaoService } from "./sessao.service";

const PATH = "/ws/sessao";

function sala(codigo: string): string {
  return `sessao:${codigo.trim().toUpperCase()}`;
}

/**
 * Canal ao vivo da sessão de aula.
 *
 * Transporta apenas **orquestração** — "o professor liberou tal bloco",
 * presença — e não o progresso passo a passo do caso (esse é coletado ao fim).
 * O estado autoritativo vive no banco (`SessaoService`), então uma queda daqui
 * degrada para "sem live", não para "sessão perdida": o cockpit e a sala podem
 * cair para polling REST do mesmo estado.
 */
@WebSocketGateway({
  path: PATH,
  cors: { origin: "*" },
  // Fechar um app/aba sem o handshake normal (matar o processo, trocar de
  // rede no celular, etc.) só é percebido pelo servidor quando o heartbeat
  // expira — com o default do socket.io (pingInterval 25s + pingTimeout
  // 20s) isso podia levar quase 45s, e o contador de conectados ficava
  // "preso" nesse meio tempo. Reduzido pra detectar bem mais rápido sem
  // ficar agressivo demais com redes mais lentas.
  pingInterval: 10_000,
  pingTimeout: 8_000,
})
export class SessaoGateway {
  private readonly logger = new Logger(SessaoGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly sessao: SessaoService) {}

  /** Entra na sala e recebe o snapshot completo (rehidratação). */
  @SubscribeMessage("sessao:entrar")
  async entrar(
    @MessageBody() body: { codigo?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const codigo = body?.codigo?.trim().toUpperCase();
    if (!codigo) {
      client.emit("sessao:erro", { mensagem: "Código não informado." });
      return;
    }

    try {
      const estado = await this.sessao.estadoPorCodigo(codigo);
      await client.join(sala(codigo));
      client.data.codigo = codigo;

      client.emit("sessao:estado", estado);
      this.emitirPresenca(codigo);
    } catch {
      client.emit("sessao:erro", { mensagem: "Código de sessão inválido." });
    }
  }

  handleDisconnect(client: Socket): void {
    const codigo = client.data?.codigo;
    if (typeof codigo === "string") this.emitirPresenca(codigo);
  }

  /**
   * Publica o novo estado para a sala inteira. Chamado pelo controller depois
   * de cada ação do professor — a escrita no banco vem primeiro.
   */
  publicarEstado(codigo: string, estado: unknown): void {
    if (!this.server) {
      // Não deveria acontecer em produção (o Nest injeta o server antes de
      // qualquer request HTTP ser servida) — logado pra não sumir em
      // silêncio caso aconteça, já que esse era exatamente o tipo de falha
      // que faria uma atualização nunca chegar à turma.
      this.logger.warn(
        `publicarEstado(${codigo}) chamado antes do WebSocketServer estar pronto.`,
      );
      return;
    }
    this.server.to(sala(codigo)).emit("sessao:estado", estado);
    this.server.to(sala(codigo)).emit("sessao:atividade", estado);
  }

  /** Conexões na sala — presença aproximada, suficiente para "N na sala". */
  private emitirPresenca(codigo: string): void {
    const room = this.server?.sockets?.adapter?.rooms?.get(sala(codigo));
    this.server?.to(sala(codigo)).emit("sessao:presenca", {
      conectados: room ? room.size : 0,
    });
  }
}
