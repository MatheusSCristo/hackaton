import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  CustomButton,
  CustomSelect,
} from "@cursosactive/p360-new-ui";
import { RefreshCw, Settings2, Users } from "lucide-react";

import { useUpdateBloco } from "@/hooks/useBlocos";
import {
  useColetarCaso,
  usePrepararCaso,
  useProgressoCaso,
  useTurmas,
} from "@/hooks/useCaso";
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

const MODO_OPTIONS = [
  { value: "autonomo", label: "Alunos resolvem sozinhos" },
  { value: "apresenta", label: "Eu apresento o caso" },
];

interface CasoBlocoProps {
  aulaId: string;
  bloco: Bloco;
  sessao: EstadoSessao | null;
  /** Bloco liberado agora (controle de sessão do cockpit). */
  liberado: boolean;
}

/**
 * Bloco de caso no cockpit: configurar turma/modo → preparar → (liberar pela
 * sessão) → encerrar/coletar → ver diagnóstico.
 *
 * A liberação em si é o botão da sessão (no cartão do bloco); aqui ficam a
 * configuração, o preparo no legado e os resultados.
 */
export default function CasoBloco({
  aulaId,
  bloco,
  sessao,
  liberado,
}: CasoBlocoProps) {
  const { data: turmas } = useTurmas(aulaId, bloco.id);
  const atualizar = useUpdateBloco(aulaId);
  const preparar = usePrepararCaso(aulaId);
  const coletar = useColetarCaso(aulaId);

  const output = bloco.output ?? {};
  const turmaId = Number(bloco.config.turmaId) || null;
  const modo = bloco.config.modo === "apresenta" ? "apresenta" : "autonomo";
  const preparado = Boolean(output.cursoLegacyId);
  const agregado = output.agregado as AgregadoCaso | undefined;
  const diagnostico = output.diagnostico as DiagnosticoTurma | undefined;

  const progresso = useProgressoCaso(aulaId, bloco.id, liberado);
  const turmaSelecionada = turmas?.find((t) => t.id === turmaId);

  const erro = preparar.error ?? coletar.error;

  return (
    <Box pl={{ base: 0, md: 12 }}>
      {/* Configuração */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" mb="3">
        <CustomSelect
          label="Turma"
          placeholder="Selecione a turma"
          value={turmaId ? String(turmaId) : ""}
          options={(turmas ?? []).map((t) => ({
            value: String(t.id),
            label: t.nome,
          }))}
          onChange={(value) =>
            atualizar.mutate({
              blocoId: bloco.id,
              config: { ...bloco.config, turmaId: Number(value) },
            })
          }
        />
        <CustomSelect
          label="Como vai rodar"
          placeholder="Selecione"
          value={modo}
          options={MODO_OPTIONS}
          onChange={(value) =>
            atualizar.mutate({
              blocoId: bloco.id,
              config: { ...bloco.config, modo: value },
            })
          }
        />
      </SimpleGrid>

      {turmaSelecionada?.codigoAcesso && (
        <Text fontSize="2xs" color="gray.500" mb="3">
          Alunos sem matrícula podem entrar na turma com o código{" "}
          <b>{turmaSelecionada.codigoAcesso}</b> — quem entrar pela sala é
          matriculado automaticamente.
        </Text>
      )}

      {modo === "apresenta" && (
        <Text fontSize="2xs" color="orange.600" mb="3">
          No modo apresentação não há execução por aluno — o diagnóstico da IA
          só fica rico no modo &quot;alunos resolvem sozinhos&quot;.
        </Text>
      )}

      {/* Ações */}
      <HStack gap="2" wrap="wrap" mb="3">
        <CustomButton
          variant={preparado ? "outline" : "solid"}
          icon={Settings2}
          size="sm"
          isLoading={preparar.isPending}
          disabled={!turmaId}
          onClick={() => preparar.mutate(bloco.id)}
        >
          {preparado ? "Repreparar" : "Preparar o caso"}
        </CustomButton>

        {preparado && (
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
        )}
      </HStack>

      {!preparado && (
        <Text fontSize="2xs" color="gray.400" mb="3">
          Preparar cria o acesso da turma ao caso no Paciente 360 (fechado até
          você liberar).
        </Text>
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
          <Text fontSize="xs" color="red.700">
            {mensagemErro(erro)}
          </Text>
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
