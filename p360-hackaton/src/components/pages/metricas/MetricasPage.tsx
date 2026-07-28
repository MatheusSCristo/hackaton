import { useNavigate } from "react-router";
import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@cursosactive/p360-new-ui";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  BookOpen,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "../aula/AppIcon";
import { useMetricasDetalhadas } from "@/hooks/useMetricas";
import type {
  DesempenhoAluno,
  DesempenhoPorAula,
  QuestaoDificil,
} from "@/services/metricas";

const corPct = (pct: number): string =>
  pct >= 70 ? "green" : pct >= 50 ? "orange" : "red";

export default function MetricasPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMetricasDetalhadas();

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottomWidth="1px" borderColor="gray.200">
        <Flex
          px={{ base: 4, md: 8 }}
          py="5"
          direction="column"
          gap="1"
        >
          <Flex
            as="button"
            align="center"
            gap="1"
            color="gray.500"
            cursor="pointer"
            _hover={{ color: "gray.700" }}
            onClick={() => navigate("/")}
          >
            <AppIcon icon={ArrowLeft} size={14} />
            <Text fontSize="sm">Voltar</Text>
          </Flex>
          <Heading size="lg" color="gray.900">
            Métricas
          </Heading>
          <Text fontSize="sm" color="gray.500">
            Desempenho real da turma em simulados e enquetes — onde ela erra
            mais, quem precisa de mais atenção.
          </Text>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="6">
        {isLoading || !data ? (
          <Flex justify="center" py="16">
            <Spinner color="blue.500" />
          </Flex>
        ) : (
          <Stack gap="6">
            <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
              <StatTile
                icon={BookOpen}
                color="blue"
                label="Aulas criadas"
                value={data.kpis.totalAulas}
              />
              <StatTile
                icon={Users}
                color="purple"
                label="Alunos impactados"
                value={data.kpis.alunosImpactados}
              />
              <StatTile
                icon={Target}
                color="green"
                label="Média de acertos"
                value={`${data.kpis.mediaAcertos}%`}
              />
              <StatTile
                icon={Activity}
                color="orange"
                label="Engajamento"
                value={`${data.kpis.engajamento}%`}
              />
            </SimpleGrid>

            <Painel
              titulo="Questões com mais dificuldade"
              descricao="As perguntas (de simulado ou enquete) onde a turma mais erra — priorize reforçar esses pontos."
            >
              {data.questoesMaisDificeis.length === 0 ? (
                <Vazio texto="Ainda não há respostas de simulado ou enquete suficientes." />
              ) : (
                <Stack gap="2">
                  {data.questoesMaisDificeis.map((q, i) => (
                    <QuestaoRow key={`${q.blocoId}-${i}`} questao={q} />
                  ))}
                </Stack>
              )}
            </Painel>

            <Painel
              titulo="Desempenho por aluno"
              descricao="Só simulado — a enquete não identifica quem respondeu. Ordenado do menor pro maior desempenho."
            >
              {data.desempenhoPorAluno.length === 0 ? (
                <Vazio texto="Ainda não há tentativas de simulado registradas." />
              ) : (
                <Stack gap="1">
                  {data.desempenhoPorAluno.map((a) => (
                    <AlunoRow key={a.usuarioId} aluno={a} />
                  ))}
                </Stack>
              )}
            </Painel>

            <Painel titulo="Por aula" descricao="Visão consolidada de cada aula.">
              {data.porAula.length === 0 ? (
                <Vazio texto="Nenhuma aula com dados ainda." />
              ) : (
                <Stack gap="2">
                  {data.porAula.map((a) => (
                    <AulaRow key={a.aulaId} aula={a} />
                  ))}
                </Stack>
              )}
            </Painel>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function StatTile({
  icon,
  color,
  label,
  value,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string | number;
}) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p="4">
      <Flex align="center" gap="2" mb="1">
        <AppIcon icon={icon} size={16} color={`${color}.500`} />
        <Text fontSize="xs" color="gray.500">
          {label}
        </Text>
      </Flex>
      <Text fontSize="2xl" fontWeight="bold" color="gray.900">
        {value}
      </Text>
    </Box>
  );
}

function Painel({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="gray.200" borderRadius="xl" p={{ base: 4, md: 6 }}>
      <Heading size="sm" color="gray.800" mb="0.5">
        {titulo}
      </Heading>
      {descricao && (
        <Text fontSize="xs" color="gray.500" mb="4">
          {descricao}
        </Text>
      )}
      {children}
    </Box>
  );
}

function QuestaoRow({ questao }: { questao: QuestaoDificil }) {
  const cor = corPct(questao.pctAcerto);
  return (
    <Box borderWidth="1px" borderColor="gray.100" borderRadius="lg" p="3">
      <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap" mb="1.5">
        <HStack gap="2" wrap="wrap">
          <Badge
            variant="subtle"
            colorPalette={questao.tipo === "simulado" ? "green" : "purple"}
            borderRadius="full"
            fontSize="2xs"
          >
            {questao.tipo === "simulado" ? "Simulado" : "Enquete"}
          </Badge>
          <Text fontSize="xs" color="gray.400">
            {questao.aulaTitulo}
          </Text>
        </HStack>
        <HStack gap="1.5" flexShrink={0}>
          {questao.pctAcerto < 50 && <AlertTriangle size={13} color="#C53030" />}
          <Badge variant="subtle" colorPalette={cor} borderRadius="full" fontSize="xs">
            {questao.pctAcerto}% de acerto
          </Badge>
        </HStack>
      </Flex>
      <Text fontSize="sm" color="gray.800" mb="1">
        {questao.enunciado}
      </Text>
      <Box h="6px" bg="gray.100" borderRadius="full" overflow="hidden" mb="1">
        <Box h="full" w={`${questao.pctAcerto}%`} bg={`${cor}.500`} borderRadius="full" />
      </Box>
      <Text fontSize="2xs" color="gray.400">
        {questao.respostas} {questao.respostas === 1 ? "resposta" : "respostas"}
      </Text>
    </Box>
  );
}

function AlunoRow({ aluno }: { aluno: DesempenhoAluno }) {
  const cor = corPct(aluno.mediaAcertos);
  return (
    <Flex justify="space-between" align="center" gap="3" py="2" borderBottomWidth="1px" borderColor="gray.50">
      <Text fontSize="sm" color="gray.800" truncate>
        {aluno.nome ?? `Aluno ${aluno.usuarioId}`}
      </Text>
      <HStack gap="3" flexShrink={0}>
        <Text fontSize="xs" color="gray.500">
          {aluno.tentativas} {aluno.tentativas === 1 ? "tentativa" : "tentativas"}
        </Text>
        <Badge variant="subtle" colorPalette={cor} borderRadius="full" fontSize="xs">
          {aluno.mediaAcertos}%
        </Badge>
      </HStack>
    </Flex>
  );
}

function AulaRow({ aula }: { aula: DesempenhoPorAula }) {
  return (
    <Flex justify="space-between" align="center" gap="3" py="2" borderBottomWidth="1px" borderColor="gray.50" wrap="wrap">
      <Text fontSize="sm" color="gray.800" flex="1" minW="160px" truncate>
        {aula.aulaTitulo}
      </Text>
      <HStack gap="4" flexShrink={0}>
        <Text fontSize="xs" color="gray.500">
          Simulado: {aula.tentativasSimulado} ·{" "}
          {aula.mediaSimulado !== null ? `${aula.mediaSimulado}%` : "—"}
        </Text>
        <Text fontSize="xs" color="gray.500">
          Enquete: {aula.questoesEnquete} ·{" "}
          {aula.mediaEnquete !== null ? `${aula.mediaEnquete}%` : "—"}
        </Text>
      </HStack>
    </Flex>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <Box borderWidth="1px" borderColor="gray.100" borderStyle="dashed" borderRadius="lg" p="6" textAlign="center">
      <Text fontSize="sm" color="gray.400">
        {texto}
      </Text>
    </Box>
  );
}
