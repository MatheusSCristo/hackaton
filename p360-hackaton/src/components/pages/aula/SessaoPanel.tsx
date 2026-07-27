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
import { Radio, Share2, Square, Users } from "lucide-react";

import { BLOCO_META } from "./blocoMeta";
import { useCriarSessao, useEncerrarSessao } from "@/hooks/useSessao";
import type { EstadoSessao } from "@/services/sessao";
import type { TipoBloco } from "@/services/blocos";

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
  const criar = useCriarSessao(aulaId);
  const encerrar = useEncerrarSessao(aulaId);

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
          Abra a sessão para gerar o link de entrada da turma.
        </Text>
        <CustomButton
          variant="solid"
          icon={Radio}
          size="sm"
          isLoading={criar.isPending}
          onClick={() => criar.mutate()}
        >
          Abrir sessão
        </CustomButton>
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
