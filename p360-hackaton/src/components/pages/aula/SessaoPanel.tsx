import { useRef } from "react";
import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import { PlayCircle, Radio, Share2, Square, Users, X } from "lucide-react";

import { BLOCO_META } from "./blocoMeta";
import { useConfirmarInicioSessao, useEncerrarSessao } from "@/hooks/useSessao";
import type { EstadoSessao } from "@/services/sessao";
import type { TipoBloco } from "@/services/blocos";
import { getAccessToken } from "@/utils/accessToken";

interface SessaoPanelProps {
  aulaId: string;
  /** Estado já resolvido pelo cockpit (socket tem precedência sobre REST). */
  estado: EstadoSessao | null;
  isLoading: boolean;
  conectados: number | null;
  conectado: boolean;
  erroLive: string | null;
}

/**
 * Painel de controle da sessão ao vivo. O aluno entra por um link único desta
 * casca e acompanha tudo por lá — sem precisar navegar em vários lugares.
 *
 * Apresentacional quanto ao estado: quem consulta é o cockpit, para que os
 * botões de cada bloco compartilhem a mesma sessão.
 */
export default function SessaoPanel({
  aulaId,
  estado,
  isLoading,
  conectados,
  conectado,
  erroLive,
}: SessaoPanelProps) {
  const encerrar = useEncerrarSessao(aulaId);
  const confirmar = useConfirmarInicioSessao(aulaId);

  // Referência da janela de QR Code — permite fechá-la na hora, direto, sem
  // depender só do socket (que a própria janela também escuta e usa pra se
  // fechar sozinha; isto aqui é redundância de propósito, mais confiável).
  const janelaQrRef = useRef<Window | null>(null);

  /**
   * Abre a tela de QR Code numa janela própria — é ela quem cria (ou
   * reaproveita) a sessão, nunca este clique diretamente. Essa janela é só
   * pra projetar (QR Code + link, nada de controle/contagem — isso é só
   * daqui, que é privado do professor).
   */
  const abrirTelaDeSessao = () => {
    const token = getAccessToken();
    const url = token
      ? `/aulas/${aulaId}/sessao/abrir?accessToken=${encodeURIComponent(token)}`
      : `/aulas/${aulaId}/sessao/abrir`;
    // Sem `noopener` aqui de propósito: precisamos da referência pra fechar a
    // janela depois (confirmar/cancelar). É a mesma origem/rota nossa, então
    // não há o risco de reverse tabnabbing que `noopener` normalmente evita.
    janelaQrRef.current = window.open(
      url,
      "p360-sessao-qr",
      "width=900,height=700",
    );
  };

  const fecharJanelaQr = () => {
    if (janelaQrRef.current && !janelaQrRef.current.closed) {
      janelaQrRef.current.close();
    }
  };

  if (isLoading) {
    return (
      <Text fontSize="sm" color="gray.500">
        Carregando sessão…
      </Text>
    );
  }

  if (!estado) {
    return (
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        p={{ base: 4, md: 5 }}
      >
        <Heading size="sm" color="gray.800" mb="1">
          Sessão ao vivo
        </Heading>
        <Text fontSize="sm" color="gray.500" mb="4">
          Abra a sessão para gerar o QR Code/link de entrada da turma.
        </Text>
        <CustomButton variant="solid" icon={Radio} size="sm" onClick={abrirTelaDeSessao}>
          Abrir sessão
        </CustomButton>
      </Box>
    );
  }

  // Sala aberta, mas o professor ainda não confirmou: só ele vê quantos já
  // entraram e decide se coloca a aula no ar ou desiste (a projeção — tela
  // de QR Code — não mostra nada disso, de propósito).
  if (estado.status === "aguardando") {
    return (
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="orange.300"
        borderRadius="xl"
        p={{ base: 4, md: 5 }}
      >
        <Heading size="sm" color="gray.800" mb="1">
          Sessão ao vivo
        </Heading>
        <Text fontSize="sm" color="gray.500" mb="3">
          A sala está aberta — a turma já pode entrar pelo QR Code projetado.
        </Text>
        <Flex align="center" gap="2" color="gray.600" mb="4">
          <Users size={14} />
          <Text fontSize="sm">
            {conectados ?? estado.participantes}{" "}
            {(conectados ?? estado.participantes) === 1
              ? "usuário conectado"
              : "usuários conectados"}
          </Text>
        </Flex>
        <HStack gap="2">
          <CustomButton
            variant="solid"
            icon={PlayCircle}
            size="sm"
            isLoading={confirmar.isPending}
            onClick={() =>
              confirmar.mutate(estado.sessaoId, { onSuccess: fecharJanelaQr })
            }
          >
            Confirmar início da sessão
          </CustomButton>
          <CustomButton
            variant="outline"
            icon={X}
            size="sm"
            isLoading={encerrar.isPending}
            onClick={() =>
              encerrar.mutate(estado.sessaoId, { onSuccess: fecharJanelaQr })
            }
          >
            Cancelar
          </CustomButton>
        </HStack>
      </Box>
    );
  }

  const linkAluno = `${window.location.origin}/sala/${estado.codigo}`;
  const encerrada = estado.status === "encerrada";
  const blocoAtual = estado.blocoAtual;
  const metaAtual = blocoAtual
    ? BLOCO_META[blocoAtual.tipo as TipoBloco]
    : null;

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor={encerrada ? "gray.200" : "green.300"}
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
    >
      <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap">
        <Box>
          <Flex align="center" gap="2" mb="1">
            <Heading size="sm" color="gray.800">
              Sessão ao vivo
            </Heading>
            <Badge
              variant="subtle"
              colorPalette={encerrada ? "gray" : "green"}
              borderRadius="full"
              fontSize="xs"
            >
              {encerrada ? "encerrada" : estado.status}
            </Badge>
            {conectado && !encerrada && (
              <Badge
                variant="subtle"
                colorPalette="green"
                borderRadius="full"
                fontSize="2xs"
              >
                conectado
              </Badge>
            )}
          </Flex>
          <Text fontSize="xs" color="gray.500">
            Código de entrada da turma
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="bold"
            color="gray.900"
            letterSpacing="wider"
            fontFamily="mono"
          >
            {estado.codigo}
          </Text>
        </Box>

        <Stack gap="2" align="flex-end">
          <HStack gap="3">
            <Flex align="center" gap="1" color="gray.600">
              <Users size={14} />
              <Text fontSize="xs">
                {conectados ?? estado.participantes} na sala
              </Text>
            </Flex>
          </HStack>
          {!encerrada && (
            <CustomButton
              variant="outline"
              icon={Square}
              size="sm"
              isLoading={encerrar.isPending}
              onClick={() => encerrar.mutate(estado.sessaoId)}
            >
              Encerrar sessão
            </CustomButton>
          )}
        </Stack>
      </Flex>

      <Box
        mt="3"
        p="3"
        bg="gray.50"
        borderRadius="lg"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Flex align="center" gap="2" mb="1">
          <Share2 size={13} color="#4A5568" />
          <Text fontSize="xs" fontWeight="semibold" color="gray.700">
            Link para os alunos
          </Text>
        </Flex>
        <Text fontSize="xs" color="gray.600" wordBreak="break-all">
          {linkAluno}
        </Text>
      </Box>

      <Box mt="3">
        <Text fontSize="xs" color="gray.500">
          Atividade atual:{" "}
          <Text as="span" fontWeight="semibold" color="gray.800">
            {blocoAtual
              ? `${metaAtual?.titulo ?? blocoAtual.tipo} (${estado.estadoAtual})`
              : "nenhuma liberada"}
          </Text>
        </Text>
      </Box>

      {erroLive && (
        <Text fontSize="xs" color="red.600" mt="2">
          {erroLive}
        </Text>
      )}
    </Box>
  );
}
