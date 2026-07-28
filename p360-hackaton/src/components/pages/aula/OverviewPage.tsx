import { useNavigate } from "react-router";
import {
  AspectRatio,
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  Image,
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
  Stethoscope,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "./AppIcon";
import { BLOCO_META } from "./blocoMeta";
import { useInsights, useOverview, useRemoverAula } from "@/hooks/useAulas";
import type { Aula, DicaIA } from "@/services/aulas";
import type { TipoBloco } from "@/services/blocos";
import { buildFotoUrl } from "@/services/casos";

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
              Aula Conectada
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Suas aulas, o desempenho das turmas e o que a IA sugere reforçar.
            </Text>
          </Box>
          <HStack gap="2">
            <CustomButton
              variant="outline"
              icon={Target}
              onClick={() => navigate("/metricas")}
            >
              Ver métricas
            </CustomButton>
            <CustomButton
              variant="solid"
              icon={Plus}
              onClick={() => navigate("/nova-aula")}
            >
              Criar nova aula
            </CustomButton>
          </HStack>
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
                Insights rápidos
              </Heading>
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
              <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} gap="3">
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
  const remover = useRemoverAula();
  const data = new Date(aula.createdAt).toLocaleDateString("pt-BR");
  const fotoUrl = buildFotoUrl(aula.casoImagem ?? null);

  const handleRemover = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Remover a aula "${aula.titulo}"? Essa ação não pode ser desfeita.`)) {
      remover.mutate(aula.id);
    }
  };

  return (
    <Box
      as="button"
      position="relative"
      textAlign="left"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      h="full"
      cursor="pointer"
      transition="border-color 0.15s, box-shadow 0.15s"
      _hover={{ borderColor: "blue.300", boxShadow: "sm" }}
      onClick={() => navigate(`/aulas/${aula.id}`)}
    >
      <IconButton
        aria-label="Remover aula"
        position="absolute"
        top="2"
        right="2"
        zIndex="1"
        size="xs"
        variant="solid"
        bg="whiteAlpha.900"
        color="red.500"
        borderRadius="full"
        boxShadow="sm"
        loading={remover.isPending}
        onClick={handleRemover}
        _hover={{ bg: "red.50" }}
      >
        <Trash2 size={13} />
      </IconButton>

      {fotoUrl ? (
        <AspectRatio ratio={4 / 3} w="full" flexShrink={0}>
          <Image src={fotoUrl} alt="" objectFit="cover" />
        </AspectRatio>
      ) : aula.casoTitulo ? (
        <AspectRatio ratio={4 / 3} w="full" flexShrink={0}>
          <Flex bg="teal.50" align="center" justify="center">
            <AppIcon icon={Stethoscope} size={28} color="teal.300" />
          </Flex>
        </AspectRatio>
      ) : null}

      <Box p="4" display="flex" flexDirection="column" flex="1">
        <Text fontSize="xs" color="gray.400" mb="0.5">
          {data}
          {aula.publico ? ` · ${aula.publico}` : ""}
        </Text>
      <Text fontWeight="bold" color="gray.900" lineHeight="1.3" lineClamp={2}>
        {aula.titulo}
      </Text>

        <SequenciaBadges aula={aula} />
      </Box>
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
