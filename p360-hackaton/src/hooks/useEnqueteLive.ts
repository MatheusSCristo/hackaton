import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import Environment from "@/config/env";
import { getAccessToken } from "@/utils/accessToken";

const WS_PATH = "/ws/poll360";

export interface OpcaoAoVivo {
  id: string;
  optionText?: string;
  text?: string;
}

export interface PollAoVivo {
  id?: string;
  questionText?: string;
  title?: string;
  options?: OpcaoAoVivo[];
}

/**
 * Controle ao vivo da enquete, falando direto com o gateway do poll360.
 *
 * O poll360 identifica o **speaker** pelo token do handshake: quem é dono da
 * sessão entra na sala `poll:<pin>:speakers` e só ele pode iniciar/encerrar
 * (`assertSpeaker` no gateway). Por isso o professor precisa conectar daqui —
 * o backend do hackaton só cria o conteúdo e abre a sessão.
 */
export function useEnqueteLive(accessPin: string | undefined) {
  const [conectado, setConectado] = useState(false);
  const [ehSpeaker, setEhSpeaker] = useState(false);
  const [participantes, setParticipantes] = useState<number | null>(null);
  const [pollAtivo, setPollAtivo] = useState<PollAoVivo | null>(null);
  const [votos, setVotos] = useState<Record<string, number>>({});
  const [totalVotos, setTotalVotos] = useState(0);
  const [encerrada, setEncerrada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessPin) return;

    const base = Environment.VITE_POLL360_WS_URL;
    const token = getAccessToken();

    const socket = io(base, {
      path: WS_PATH,
      transports: ["websocket"],
      // O gateway lê o token do handshake para reconhecer o speaker.
      auth: { token, source: "legacy" },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConectado(true);
      setErro(null);
      socket.emit("poll:join", { pin: accessPin });
    });
    socket.on("disconnect", () => setConectado(false));

    socket.on(
      "poll:joined",
      (payload: { role?: string; activePoll?: PollAoVivo }) => {
        // O gateway devolve o papel em minúsculas ("speaker"); comparar sem
        // considerar caixa evita depender do formato do enum do poll360.
        setEhSpeaker(String(payload?.role ?? "").toLowerCase() === "speaker");
        if (payload?.activePoll) setPollAtivo(payload.activePoll);
      },
    );

    socket.on("poll:started", (payload: { poll?: PollAoVivo }) => {
      setPollAtivo(payload?.poll ?? null);
      setVotos({});
      setTotalVotos(0);
      setEncerrada(false);
    });

    const aplicarResultados = (payload: {
      results?: Record<string, number>;
      totalVotes?: number;
    }) => {
      setVotos(payload?.results ?? {});
      setTotalVotos(payload?.totalVotes ?? 0);
    };
    socket.on("poll:results", aplicarResultados);
    socket.on("poll:partial-results", aplicarResultados);

    socket.on("poll:ended", (payload: { results?: Record<string, number> }) => {
      setEncerrada(true);
      if (payload?.results) aplicarResultados(payload);
    });

    socket.on("poll:participant-count", (p: { participants?: number }) =>
      setParticipantes(p?.participants ?? null),
    );

    socket.on("error", () =>
      setErro(
        "O poll360 recusou a ação. Confirme que você é o dono da sessão.",
      ),
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessPin]);

  const emitir = useCallback(
    (evento: string, extra: Record<string, unknown> = {}) => {
      if (!accessPin || !socketRef.current) return;
      setErro(null);
      socketRef.current.emit(evento, { pin: accessPin, ...extra });
    },
    [accessPin],
  );

  return {
    conectado,
    ehSpeaker,
    participantes,
    pollAtivo,
    votos,
    totalVotos,
    encerrada,
    erro,
    iniciar: () => emitir("poll:start"),
    mostrarResultados: () => emitir("poll:show-results"),
    encerrarQuestao: () => emitir("poll:end", { showResults: true }),
    encerrarSessao: () => emitir("poll:end-session"),
  };
}
