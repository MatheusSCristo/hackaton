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
import { RefreshCw, Users } from "lucide-react";

import { useColetarCaso, usePrepararCaso, useProgressoCaso } from "@/hooks/useCaso";
import type { Bloco } from "@/services/blocos";
import type {
  AgregadoCaso,
  DiagnosticoTurma,
  PontoFraco,
} from "@/services/caso";
import type { EstadoSessao } from "@/services/sessao";

const SEVERIDADE_COR: Record<PontoFraco["severidade"], string> = {
  alta: "red",
  media: "orange",
  baixa: "gray",
};

interface CasoBlocoProps {
  aulaId: string;
  bloco: Bloco;
  sessao: EstadoSessao | null;
  /** Bloco liberado agora (controle de sessão do cockpit). */
  liberado: boolean;
}

/**
 * Bloco de caso no cockpit — turma e "quem vai fazer" já foram decididos na
 * etapa Criar, e o preparo no legado já rodou sozinho ao criar a aula (ver
 * `AulaConectadaPage.handleCriarEGerarTudo`). Aqui só fica o que acontece
 * DEPOIS disso: liberar (botão fica no cartão da sessão), acompanhar e
 * coletar os resultados.
 */
export default function CasoBloco({
  aulaId,
  bloco,
  sessao,
  liberado,
}: CasoBlocoProps) {
  const preparar = usePrepararCaso(aulaId);
  const coletar = useColetarCaso(aulaId);

  const output = bloco.output ?? {};
  const preparado = Boolean(output.cursoLegacyId);
  const agregado = output.agregado as AgregadoCaso | undefined;
  const diagnostico = output.diagnostico as DiagnosticoTurma | undefined;

  const progresso = useProgressoCaso(aulaId, bloco.id, liberado);

  const erro = preparar.error ?? coletar.error;

  return (
    <Box pl={{ base: 0, md: 12 }}>
      {/* O preparo já roda sozinho na criação da aula — se ainda não
          aconteceu ao chegar aqui, é porque algo deu errado lá (turma sem
          código de acesso, legado fora do ar etc.), não que ainda está em
          andamento. Por isso a saída manual aqui, mesmo sem um botão
          "Preparar" no fluxo normal. */}
      {!preparado && !erro && (
        <Box
          bg="orange.50"
          borderWidth="1px"
          borderColor="orange.200"
          borderRadius="lg"
          p="3"
          mb="3"
        >
          <Text fontSize="xs" color="orange.800" mb="2">
            O caso ainda não foi preparado — o passo automático da criação
            não chegou a rodar ou não terminou.
          </Text>
          <CustomButton
            variant="outline"
            size="sm"
            isLoading={preparar.isPending}
            onClick={() => preparar.mutate(bloco.id)}
          >
            Preparar agora
          </CustomButton>
        </Box>
      )}

      {preparado && (
        <HStack gap="2" wrap="wrap" mb="3">
          <CustomButton
            variant="outline"
            icon={RefreshCw}
            size="sm"
            isLoading={coletar.isPending}
            disabled={!output.liberadoEm}
            onClick={() => coletar.mutate(bloco.id)}
          >
            Atualizar resultados
          </CustomButton>
        </HStack>
      )}

      {!sessao && preparado && (
        <Text fontSize="2xs" color="gray.500" mb="3">
          Abra a sessão ao vivo acima para liberar o caso para a turma.
        </Text>
      )}

      {erro && (
        <Box
          bg="red.50"
          borderWidth="1px"
          borderColor="red.200"
          borderRadius="lg"
          p="3"
          mb="3"
        >
          <Text fontSize="xs" color="red.700" mb="2">
            Não foi possível preparar o caso automaticamente:{" "}
            {mensagemErro(erro)}
          </Text>
          <CustomButton
            variant="outline"
            size="sm"
            isLoading={preparar.isPending}
            onClick={() => preparar.mutate(bloco.id)}
          >
            Tentar de novo
          </CustomButton>
        </Box>
      )}

      {/* Contador durante a janela */}
      {liberado && progresso.data && (
        <Box
          bg="blue.50"
          borderWidth="1px"
          borderColor="blue.200"
          borderRadius="lg"
          p="3"
          mb="3"
        >
          <Flex align="center" gap="2">
            <Users size={14} color="#2B6CB0" />
            <Text fontSize="sm" color="blue.900" fontWeight="semibold">
              {progresso.data.concluidos} de {progresso.data.alunosTotal}{" "}
              concluíram
            </Text>
            <Text fontSize="xs" color="blue.700">
              · {progresso.data.iniciaram} começaram
            </Text>
          </Flex>
        </Box>
      )}

      {agregado && <Agregado agregado={agregado} />}
      {diagnostico && <Diagnostico diagnostico={diagnostico} />}
    </Box>
  );
}

function Agregado({ agregado }: { agregado: AgregadoCaso }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      p="4"
      mb="3"
    >
      <Heading size="xs" color="gray.700" mb="3">
        Desempenho da turma
      </Heading>

      <HStack gap="4" mb="3" wrap="wrap">
        <Metrica label="Alunos" valor={agregado.alunosTotal} />
        <Metrica label="Participaram" valor={`${agregado.engajamento}%`} />
        <Metrica label="Concluíram" valor={`${agregado.taxaConclusao}%`} />
      </HStack>

      <Stack gap="2">
        {agregado.etapas.map((etapa) => (
          <Box key={etapa.chave}>
            <Flex justify="space-between" mb="1">
              <Text fontSize="xs" color="gray.600">
                {etapa.label}
              </Text>
              <Text fontSize="xs" fontWeight="semibold" color="gray.700">
                {etapa.porcentagem}%
              </Text>
            </Flex>
            <Box h="5px" bg="gray.100" borderRadius="full" overflow="hidden">
              <Box
                h="full"
                w={`${etapa.porcentagem}%`}
                bg={
                  etapa.porcentagem >= 70
                    ? "green.500"
                    : etapa.porcentagem >= 40
                      ? "orange.400"
                      : "red.400"
                }
                borderRadius="full"
              />
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function Metrica({ label, valor }: { label: string; valor: string | number }) {
  return (
    <Box>
      <Text fontSize="2xs" color="gray.500">
        {label}
      </Text>
      <Text fontSize="lg" fontWeight="bold" color="gray.900">
        {valor}
      </Text>
    </Box>
  );
}

function Diagnostico({ diagnostico }: { diagnostico: DiagnosticoTurma }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="lg"
      p="4"
      bg="gray.50"
    >
      <Flex align="center" gap="2" mb="2">
        <Heading size="xs" color="gray.700">
          O que reforçar
        </Heading>
        {!diagnostico.ia && (
          <Badge variant="subtle" colorPalette="gray" fontSize="2xs">
            heurística
          </Badge>
        )}
      </Flex>

      {diagnostico.resumo && (
        <Text fontSize="xs" color="gray.600" mb="3">
          {diagnostico.resumo}
        </Text>
      )}

      <Stack gap="2">
        {diagnostico.pontosFracos.map((ponto, index) => (
          <Box
            key={`${index}-${ponto.titulo}`}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="md"
            p="3"
          >
            <Flex justify="space-between" gap="2" mb="1">
              <Text fontWeight="semibold" fontSize="sm" color="gray.900">
                {ponto.titulo}
              </Text>
              <Badge
                variant="subtle"
                colorPalette={SEVERIDADE_COR[ponto.severidade]}
                borderRadius="full"
                fontSize="2xs"
              >
                {ponto.severidade}
              </Badge>
            </Flex>
            {ponto.descricao && (
              <Text fontSize="xs" color="gray.600">
                {ponto.descricao}
              </Text>
            )}
            {ponto.evidencia && (
              <Text fontSize="2xs" color="gray.500" mt="1">
                Evidência: {ponto.evidencia}
              </Text>
            )}
            {ponto.sugestaoReforco && (
              <Text fontSize="2xs" color="blue.700" mt="1">
                → {ponto.sugestaoReforco}
              </Text>
            )}
          </Box>
        ))}
      </Stack>

      <Text fontSize="2xs" color="gray.500" mt="3">
        Estes pontos alimentam o bloco de reforço e a enquete com foco nos
        pontos fracos.
      </Text>
    </Box>
  );
}

function mensagemErro(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === "object" && data !== null) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.join(", ");
    }
    const fallback = (error as { message?: unknown }).message;
    if (typeof fallback === "string") return fallback;
  }
  return "Não foi possível concluir a operação.";
}
