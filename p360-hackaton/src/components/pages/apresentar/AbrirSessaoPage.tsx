import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { Box, Flex, Heading, Spinner, Stack, Text } from "@cursosactive/p360-new-ui";
import QRCode from "react-qr-code";

import { useCriarSessao, useSessaoAtual } from "@/hooks/useSessao";
import { useSessaoLive } from "@/hooks/useSessaoLive";
import { getAccessToken } from "@/utils/accessToken";

/**
 * Tela de projeção da sessão — só QR Code e o link, pensada pra ficar
 * projetada pra turma inteira ver (por isso não tem contagem de conectados
 * nem nenhum controle do professor: isso fica só no cockpit, que é privado).
 *
 * Confirmar/cancelar o início também não é daqui — é lá no cockpit
 * (`SessaoPanel`) que o professor decide, e esta janela só reage: fecha
 * sozinha assim que a sessão sair de "aguardando" (confirmada ou cancelada).
 */
export default function AbrirSessaoPage() {
  const { aulaId } = useParams<{ aulaId: string }>();

  const { data: sessaoRest, isLoading } = useSessaoAtual(aulaId);
  const criar = useCriarSessao(aulaId);
  const live = useSessaoLive(sessaoRest?.codigo);
  const sessao = live.estado ?? sessaoRest ?? null;

  // Cria (ou reaproveita) a sessão assim que a tela abre — é o único gatilho
  // de criação que sobrou: só dispara com o professor explicitamente
  // clicando em "Abrir Sessão" no cockpit, nunca sozinho.
  const tentouCriar = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (sessaoRest || tentouCriar.current || criar.isPending) return;
    tentouCriar.current = true;
    criar.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, sessaoRest]);

  // O cockpit é quem confirma/cancela — assim que a sessão deixar de estar
  // "aguardando" (virou "ativa" ou foi cancelada/"encerrada"), o trabalho
  // desta janela projetada acabou.
  useEffect(() => {
    if (sessao && sessao.status !== "aguardando") window.close();
  }, [sessao]);

  if (!getAccessToken()) {
    return (
      <Palco>
        <Heading size="lg" color="white" textAlign="center">
          Sessão expirada
        </Heading>
        <Text fontSize="sm" color="whiteAlpha.700" textAlign="center" mt="2">
          Feche esta janela e abra "Abrir Sessão" de novo pelo cockpit.
        </Text>
      </Palco>
    );
  }

  if (isLoading || !sessao || sessao.status !== "aguardando") {
    return (
      <Palco>
        <Spinner color="whiteAlpha.700" size="lg" />
      </Palco>
    );
  }

  const url = `${window.location.origin}/sala/${sessao.codigo}`;

  return (
    <Palco>
      <Stack gap="8" align="center" textAlign="center" maxW="560px" w="100%">
        <Box bg="white" p="6" borderRadius="2xl">
          <QRCode value={url} size={300} level="M" />
        </Box>

        {/* `<input readOnly>` em vez de texto: fica selecionável/copiável e
            nenhum caractere é truncado ou escondido. */}
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "12px",
            padding: "14px 18px",
            color: "white",
            fontSize: "1.25rem",
            fontFamily: "monospace",
            textAlign: "center",
          }}
        />
      </Stack>
    </Palco>
  );
}

function Palco({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100vh" bg="gray.900" align="center" justify="center" p={{ base: 6, md: 12 }}>
      {children}
    </Flex>
  );
}
