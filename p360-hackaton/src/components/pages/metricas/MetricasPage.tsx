import { useNavigate } from "react-router";
import {
  Box,
  Flex,
  Heading,
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
  CheckCircle2,
  Info,
  OctagonAlert,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "../aula/AppIcon";
import { BarraHorizontal, CORES, DistribuicaoChart, Legenda, corPorPct } from "./charts";
import { useMetricasDetalhadas } from "@/hooks/useMetricas";
import type { InsightMetrica, QuestaoDificil } from "@/services/metricas";

export default function MetricasPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMetricasDetalhadas();

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" borderBottomWidth="1px" borderColor="gray.200">
        <Flex px={{ base: 4, md: 8 }} py="5" direction="column" gap="1">
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
          <Stack gap="6" maxW="1100px" mx="auto">
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

            {data.insights.length > 0 && (
              <Stack gap="2">
                {data.insights.map((insight, i) => (
                  <InsightCard key={i} insight={insight} />
                ))}
              </Stack>
            )}

            <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6">
              <Painel
                titulo="Distribuição de desempenho"
                descricao="Quantos alunos caem em cada faixa de acerto no simulado."
              >
                {data.distribuicaoAcertos.every((f) => f.quantidade === 0) ? (
                  <Vazio texto="Ainda não há tentativas de simulado registradas." />
                ) : (
                  <DistribuicaoChart faixas={data.distribuicaoAcertos} />
                )}
              </Painel>

              <Painel titulo="Por aula" descricao="Média de acerto — simulado vs. enquete.">
                {data.porAula.length === 0 ? (
                  <Vazio texto="Nenhuma aula com dados ainda." />
                ) : (
                  <Stack gap="4">
                    <Legenda
                      itens={[
                        { cor: CORES.simulado, label: "Simulado" },
                        { cor: CORES.enquete, label: "Enquete" },
                      ]}
                    />
                    {data.porAula.map((a) => (
                      <Stack key={a.aulaId} gap="1.5">
                        <Text fontSize="xs" fontWeight="semibold" color="gray.700" truncate>
                          {a.aulaTitulo}
                        </Text>
                        {a.mediaSimulado !== null && (
                          <BarraHorizontal
                            label={`Simulado (${a.tentativasSimulado} ${a.tentativasSimulado === 1 ? "tentativa" : "tentativas"})`}
                            pct={a.mediaSimulado}
                            cor={CORES.simulado}
                            valorLabel={`${a.mediaSimulado}%`}
                          />
                        )}
                        {a.mediaEnquete !== null && (
                          <BarraHorizontal
                            label={`Enquete (${a.questoesEnquete} ${a.questoesEnquete === 1 ? "questão" : "questões"})`}
                            pct={a.mediaEnquete}
                            cor={CORES.enquete}
                            valorLabel={`${a.mediaEnquete}%`}
                          />
                        )}
                        {a.mediaSimulado === null && a.mediaEnquete === null && (
                          <Text fontSize="2xs" color="gray.400">
                            Sem respostas ainda.
                          </Text>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Painel>
            </SimpleGrid>

            <Painel
              titulo="Questões com mais dificuldade"
              descricao="As perguntas (simulado ou enquete) onde a turma mais erra — priorize reforçar esses pontos."
            >
              {data.questoesMaisDificeis.length === 0 ? (
                <Vazio texto="Ainda não há respostas de simulado ou enquete suficientes." />
              ) : (
                <Stack gap="3">
                  {data.questoesMaisDificeis.map((q, i) => (
                    <QuestaoRow key={`${q.blocoId}-${i}`} questao={q} />
                  ))}
                </Stack>
              )}
            </Painel>

            <Painel
              titulo="Desempenho por aluno"
              descricao="Só simulado — a enquete não identifica quem respondeu. Piores desempenhos primeiro."
            >
              {data.desempenhoPorAluno.length === 0 ? (
                <Vazio texto="Ainda não há tentativas de simulado registradas." />
              ) : (
                <Stack gap="2.5">
                  {data.desempenhoPorAluno.slice(0, 12).map((a) => (
                    <BarraHorizontal
                      key={a.usuarioId}
                      label={a.nome ?? `Aluno ${a.usuarioId}`}
                      sublabel={`${a.tentativas} ${a.tentativas === 1 ? "tentativa" : "tentativas"}`}
                      pct={a.mediaAcertos}
                      cor={corPorPct(a.mediaAcertos)}
                      valorLabel={`${a.mediaAcertos}%`}
                    />
                  ))}
                  {data.desempenhoPorAluno.length > 12 && (
                    <Text fontSize="2xs" color="gray.400">
                      +{data.desempenhoPorAluno.length - 12} outros alunos
                    </Text>
                  )}
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

const INSIGHT_ESTILO: Record<
  InsightMetrica["tipo"],
  { bg: string; borda: string; cor: string; icon: LucideIcon }
> = {
  critico: { bg: "red.50", borda: "red.200", cor: "#d03b3b", icon: OctagonAlert },
  atencao: { bg: "orange.50", borda: "orange.200", cor: "#fab219", icon: AlertTriangle },
  positivo: { bg: "green.50", borda: "green.200", cor: "#0ca30c", icon: CheckCircle2 },
  info: { bg: "blue.50", borda: "blue.200", cor: "#2a78d6", icon: Info },
};

function InsightCard({ insight }: { insight: InsightMetrica }) {
  const estilo = INSIGHT_ESTILO[insight.tipo];
  return (
    <Flex
      align="flex-start"
      gap="2.5"
      bg={estilo.bg}
      borderWidth="1px"
      borderColor={estilo.borda}
      borderRadius="lg"
      p="3"
    >
      <Box mt="0.5" flexShrink={0}>
        <AppIcon icon={estilo.icon} size={16} color={estilo.cor} />
      </Box>
      <Text fontSize="sm" color="gray.800">
        {insight.texto}
      </Text>
    </Flex>
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
  const cor = corPorPct(questao.pctAcerto);
  return (
    <Box borderWidth="1px" borderColor="gray.100" borderRadius="lg" p="3">
      <Flex justify="space-between" align="flex-start" gap="3" wrap="wrap" mb="1.5">
        <Flex align="center" gap="2" wrap="wrap">
          <Box
            as="span"
            fontSize="2xs"
            fontWeight="semibold"
            textTransform="uppercase"
            color={questao.tipo === "simulado" ? CORES.simulado : CORES.enquete}
            bg={questao.tipo === "simulado" ? "blue.50" : "orange.50"}
            borderRadius="full"
            px="2"
            py="0.5"
          >
            {questao.tipo === "simulado" ? "Simulado" : "Enquete"}
          </Box>
          <Text fontSize="xs" color="gray.400">
            {questao.aulaTitulo}
          </Text>
        </Flex>
      </Flex>
      <BarraHorizontal
        label={questao.enunciado}
        sublabel={`${questao.respostas} ${questao.respostas === 1 ? "resposta" : "respostas"}`}
        pct={questao.pctAcerto}
        cor={cor}
        valorLabel={`${questao.pctAcerto}% de acerto`}
      />
    </Box>
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
