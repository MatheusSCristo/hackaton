import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Estado da apresentação, compartilhado entre a janela de **controle** (no
 * notebook do professor) e a de **projeção** (no projetor).
 */
/**
 * Retrato da enquete ao vivo, espelhado do controle para a projeção.
 *
 * A projeção **não** abre socket próprio no poll360: um participante não-speaker
 * precisa de `attendeeId` para entrar na sala, e o projetor não é um aluno. Como
 * a janela de controle já recebe tudo, ela repassa por aqui.
 */
export interface EnqueteProjecao {
  pergunta: string;
  opcoes: { id: string; texto: string; votos: number; pct: number }[];
  totalVotos: number;
  encerrada: boolean;
}

export interface EstadoApresentacao {
  /** Índice do bloco atual na sequência da sessão. */
  passo: number;
  /** Slide atual, quando o bloco é de slides. */
  slide: number;
  /** Enquete ao vivo (só projetada quando `projetarDados` está ligado). */
  enquete: EnqueteProjecao | null;
  /**
   * O professor autorizou projetar os dados desta etapa.
   *
   * Existe porque ele precisa **ver antes de mostrar**: o resultado do caso ou
   * da enquete aparece primeiro só no controle.
   */
  projetarDados: boolean;
  /** Encerramento: a projeção mostra a tela de fechamento. */
  finalizada: boolean;
}

export const ESTADO_INICIAL: EstadoApresentacao = {
  passo: 0,
  slide: 0,
  enquete: null,
  projetarDados: false,
  finalizada: false,
};

const canalDe = (aulaId: string) => `p360:apresentacao:${aulaId}`;
const chaveDe = (aulaId: string) => `p360:apresentacao:estado:${aulaId}`;

/**
 * O que sobrevive a fechar a aba.
 *
 * Uma aula não acontece numa sessão de navegador só: o professor troca de aba,
 * dá F5, o notebook dorme. Voltar para a etapa 1 no meio da aula significa
 * reliberar o primeiro bloco para a turma — então o ponto em que ele estava é
 * estado da aula, não da tela.
 *
 * `enquete` (dado ao vivo, chega pelo socket) e `projetarDados` ficam de fora de
 * propósito: retomar já projetando um resultado que o professor não reautorizou
 * é justamente o que a separação controle/projeção existe para evitar.
 */
type EstadoPersistido = Pick<
  EstadoApresentacao,
  "passo" | "slide" | "finalizada"
>;

function naoNegativo(valor: unknown): number {
  return Number.isInteger(valor) && (valor as number) >= 0
    ? (valor as number)
    : 0;
}

function ler(aulaId: string): EstadoApresentacao {
  try {
    const bruto = window.localStorage.getItem(chaveDe(aulaId));
    if (!bruto) return ESTADO_INICIAL;

    const salvo = JSON.parse(bruto) as Partial<EstadoPersistido>;
    return {
      ...ESTADO_INICIAL,
      passo: naoNegativo(salvo.passo),
      slide: naoNegativo(salvo.slide),
      finalizada: salvo.finalizada === true,
    };
  } catch {
    return ESTADO_INICIAL;
  }
}

function gravar(aulaId: string, estado: EstadoApresentacao): void {
  const persistido: EstadoPersistido = {
    passo: estado.passo,
    slide: estado.slide,
    finalizada: estado.finalizada,
  };
  try {
    window.localStorage.setItem(chaveDe(aulaId), JSON.stringify(persistido));
  } catch {
    // Aba privada / storage cheio: perder a retomada é aceitável, quebrar não.
  }
}

/**
 * Sincroniza as duas janelas por `BroadcastChannel` — mesma origem, sem rede e
 * sem latência. Não usamos o socket da sessão aqui de propósito: isso é a
 * *projeção do professor*, não o que os alunos recebem.
 *
 * A janela de controle é a fonte da verdade e reemite o estado quando a
 * projeção entra (ou reconecta), para não abrir dessincronizada.
 */
export function useApresentacaoSync(
  aulaId: string | undefined,
  papel: "controle" | "projecao",
) {
  // Retoma de onde a aula parou já no primeiro render — um flash na etapa 1
  // antes de "corrigir" apareceria no projetor.
  const [estado, setEstado] = useState<EstadoApresentacao>(() =>
    aulaId ? ler(aulaId) : ESTADO_INICIAL,
  );
  const canalRef = useRef<BroadcastChannel | null>(null);
  const estadoRef = useRef<EstadoApresentacao>(estado);

  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  // Trocar de aula na mesma tela: recarrega o ponto de retomada da nova.
  const aulaCarregada = useRef(aulaId);
  useEffect(() => {
    if (!aulaId || aulaCarregada.current === aulaId) return;
    aulaCarregada.current = aulaId;
    const retomado = ler(aulaId);
    estadoRef.current = retomado;
    setEstado(retomado);
  }, [aulaId]);

  useEffect(() => {
    if (!aulaId || typeof BroadcastChannel === "undefined") return;

    const canal = new BroadcastChannel(canalDe(aulaId));
    canalRef.current = canal;

    canal.onmessage = (evento: MessageEvent) => {
      const msg = evento.data as {
        tipo?: string;
        estado?: EstadoApresentacao;
      };

      if (msg?.tipo === "estado" && msg.estado) {
        setEstado(msg.estado);
        return;
      }
      // A projeção pede o estado ao abrir; só o controle responde.
      if (msg?.tipo === "pedir-estado" && papel === "controle") {
        canal.postMessage({ tipo: "estado", estado: estadoRef.current });
      }
    };

    if (papel === "projecao") canal.postMessage({ tipo: "pedir-estado" });

    return () => {
      canal.close();
      canalRef.current = null;
    };
  }, [aulaId, papel]);

  /** Só o controle publica mudanças. */
  const atualizar = useCallback(
    (patch: Partial<EstadoApresentacao>) => {
      if (papel !== "controle") return;
      setEstado((atual) => {
        const novo = { ...atual, ...patch };
        estadoRef.current = novo;
        canalRef.current?.postMessage({ tipo: "estado", estado: novo });
        if (aulaId) gravar(aulaId, novo);
        return novo;
      });
    },
    [papel, aulaId],
  );

  return { estado, atualizar };
}
