import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import Environment from "@/config/env";
import type { EstadoSessao } from "@/services/sessao";

const WS_PATH = "/ws/sessao";

/**
 * Assina o canal ao vivo da sessão.
 *
 * O socket **não** é a fonte da verdade: ele só entrega o snapshot que o backend
 * já persistiu. Por isso, ao conectar (e ao reconectar) reemitimos
 * `sessao:entrar` e simplesmente adotamos o `sessao:estado` recebido — é o que
 * faz F5 do professor e aluno atrasado funcionarem sem estado local frágil.
 */
export function useSessaoLive(codigo: string | undefined) {
  const [estado, setEstado] = useState<EstadoSessao | null>(null);
  const [conectados, setConectados] = useState<number | null>(null);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!codigo) return;

    const base = Environment.VITE_HACKATON_API_URL || window.location.origin;
    const socket = io(base, {
      path: WS_PATH,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    const entrar = () => socket.emit("sessao:entrar", { codigo });

    socket.on("connect", () => {
      setConectado(true);
      setErro(null);
      entrar();
    });
    socket.on("disconnect", () => setConectado(false));
    socket.on("sessao:estado", (novo: EstadoSessao) => setEstado(novo));
    socket.on("sessao:atividade", (novo: EstadoSessao) => setEstado(novo));
    socket.on("sessao:presenca", (p: { conectados: number }) =>
      setConectados(p?.conectados ?? null),
    );
    socket.on("sessao:erro", (e: { mensagem?: string }) =>
      setErro(e?.mensagem ?? "Erro na sessão."),
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [codigo]);

  return { estado, conectados, conectado, erro, setEstado };
}
