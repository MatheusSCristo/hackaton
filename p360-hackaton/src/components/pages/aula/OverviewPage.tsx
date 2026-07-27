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
  CustomButton,
} from "@cursosactive/p360-new-ui";
import {
  Activity,
  BookOpen,
  Lightbulb,
  Plus,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "./AppIcon";
import { BLOCO_META } from "./blocoMeta";
import { useInsights, useOverview } from "@/hooks/useAulas";
import type { Aula, DicaIA } from "@/services/aulas";
import type { TipoBloco } from "@/services/blocos";

const PRIORIDADE_COR: Record<DicaIA["prioridade"], string> = {
  alta: "red",
  media: "orange",
  baixa: "gray",
};

export default function OverviewPage() {
  const navigate = useNavigate();
  const overview = useOverview();
  const insights = useInsights();

  const kpis = overview.data?.kpis;
  const aulas = overview.data?.aulas ?? [];

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Cabeçalho */}
      <Box bg="white" borderBottomWidth="1px" borderColor="gray.200">
        <Flex
          justify="space-between"
          align="flex-start"
          gap="4"
          wrap="wrap"
          px={{ base: 4, md: 8 }}
          py="5"
        >
          <Box>
            <Heading size="lg" color="gray.900">
              Planos de aula
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Suas aulas, o desempenho das turmas e o que a IA sugere reforçar.
            </Text>
          </Box>
          <CustomButton
            variant="solid"
            icon={Plus}
            onClick={() => navigate("/nova-aula")}
          >
            Criar nova aula
          </CustomButton>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="6">
        <Stack gap="6">
          {/* KPIs */}
          <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
            <StatTile
              icon={BookOpen}
              color="blue"
              label="Aulas criadas"
              value={kpis?.totalAulas ?? 0}
            />
            <StatTile
              icon={Users}
              color="purple"
              label="Alunos impactados"
              value={kpis?.alunosImpactados ?? 0}
            />
            <StatTile
              icon={Target}
              color="green"
              label="Média de acertos"
              value={kpis ? `${kpis.mediaAcertos}%` : "—"}
            />
            <StatTile
              icon={Activity}
              color="orange"
              label="Engajamento"
              value={kpis ? `${kpis.engajamento}%` : "—"}
            />
          </SimpleGrid>

          {/* Dicas da IA */}
          <Box
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="xl"
            p={{ base: 4, md: 6 }}
          >
            <Flex align="center" gap="2" mb="3">
              <AppIcon icon={Lightbulb} size={18} color="yellow.500" />
              <Heading size="sm" color="gray.800">
                Dicas da IA
              </Heading>
              {insights.data && !insights.data.ia && (
                <Badge variant="subtle" colorPalette="gray" fontSize="xs">
                  heurística
                </Badge>
              )}
            </Flex>
            {insights.isLoading ? (
              <Flex justify="center" py="6">
                <Spinner color="blue.500" />
              </Flex>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 3 }} gap="3">
                {(insights.data?.dicas ?? []).map((dica, i) => (
                  <Box
                    key={i}
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="lg"
                    p="4"
                    bg="gray.50"
                  >
                    <HStack justify="space-between" mb="1.5">
                      <Text fontWeight="bold" fontSize="sm" color="gray.900">
                        {dica.titulo}
                      </Text>
                      <Badge
                        variant="subtle"
                        colorPalette={PRIORIDADE_COR[dica.prioridade]}
                        fontSize="xs"
                        borderRadius="full"
                        px="2"
                      >
                        {dica.prioridade}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="gray.600" lineHeight="1.5">
                      {dica.texto}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </Box>

          {/* Lista de aulas */}
          <Box>
            <Heading size="sm" color="gray.800" mb="3">
              Aulas recentes
            </Heading>
            {overview.isLoading ? (
              <Flex justify="center" py="10">
                <Spinner color="blue.500" />
              </Flex>
            ) : aulas.length === 0 ? (
              <Box
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                borderStyle="dashed"
                borderRadius="xl"
                p="10"
                textAlign="center"
              >
                <Text color="gray.500" fontSize="sm" mb="4">
                  Você ainda não criou nenhuma aula.
                </Text>
                <CustomButton
                  variant="outline"
                  icon={Plus}
                  size="sm"
                  onClick={() => navigate("/nova-aula")}
                >
                  Criar minha primeira aula
                </CustomButton>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="3">
                {aulas.map((aula) => (
                  <AulaCard key={aula.id} aula={aula} />
                ))}
              </SimpleGrid>
            )}
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

interface StatTileProps {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string | number;
}

function StatTile({ icon, color, label, value }: StatTileProps) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p="4"
    >
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

function AulaCard({ aula }: { aula: Aula }) {
  const navigate = useNavigate();
  const data = new Date(aula.createdAt).toLocaleDateString("pt-BR");
  const acertos = aula.metrica?.mediaAcertos ?? 0;
  return (
    <Box
      as="button"
      textAlign="left"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p="4"
      display="flex"
      flexDirection="column"
      h="full"
      cursor="pointer"
      transition="border-color 0.15s, box-shadow 0.15s"
      _hover={{ borderColor: "blue.300", boxShadow: "sm" }}
      onClick={() => navigate(`/aulas/${aula.id}/apresentar`)}
    >
      <Text fontSize="xs" color="gray.400" mb="0.5">
        {data}
        {aula.publico ? ` · ${aula.publico}` : ""}
      </Text>
      <Text fontWeight="bold" color="gray.900" lineHeight="1.3" lineClamp={2}>
        {aula.titulo}
      </Text>

      {aula.metrica && (
        <Box mt="3">
          <Flex justify="space-between" mb="1">
            <Text fontSize="xs" color="gray.500">
              Média de acertos
            </Text>
            <Text fontSize="xs" fontWeight="semibold" color="gray.700">
              {acertos}%
            </Text>
          </Flex>
          <Box h="6px" bg="gray.100" borderRadius="full" overflow="hidden">
            <Box
              h="full"
              w={`${acertos}%`}
              bg={
                acertos >= 70
                  ? "green.500"
                  : acertos >= 50
                    ? "orange.400"
                    : "red.400"
              }
              borderRadius="full"
            />
          </Box>
          <HStack gap="4" mt="2">
            <Text fontSize="xs" color="gray.500">
              👥 {aula.metrica.alunosTotal} alunos
            </Text>
            <Text fontSize="xs" color="gray.500">
              ⚡ {aula.metrica.engajamento}% engaj.
            </Text>
          </HStack>
        </Box>
      )}

      <SequenciaBadges aula={aula} />
    </Box>
  );
}

/**
 * Mostra a sequência de blocos da sessão. Cai para os `materiais` do modelo
 * antigo nas aulas criadas antes do builder.
 *
 * Ambos os campos são lidos de forma defensiva: uma resposta de API mais antiga
 * (backend sem os blocos) não deve derrubar o overview.
 */
function SequenciaBadges({ aula }: { aula: Aula }) {
  const blocos = aula.blocos ?? [];
  const materiais = aula.materiais ?? [];

  const rotulos =
    blocos.length > 0
      ? blocos.map(
          (bloco) => BLOCO_META[bloco.tipo as TipoBloco]?.titulo ?? bloco.tipo,
        )
      : materiais;

  if (rotulos.length === 0) return null;

  return (
    <HStack gap="1.5" wrap="wrap" mt="3">
      {rotulos.slice(0, 4).map((rotulo, index) => (
        <Badge
          key={`${index}-${rotulo}`}
          variant="subtle"
          colorPalette="blue"
          borderRadius="full"
          px="2"
          fontSize="xs"
        >
          {rotulo}
        </Badge>
      ))}
      {rotulos.length > 4 && (
        <Text fontSize="xs" color="gray.400">
          +{rotulos.length - 4}
        </Text>
      )}
    </HStack>
  );
}
