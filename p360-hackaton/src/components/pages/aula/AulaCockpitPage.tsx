import { useNavigate, useParams } from "react-router";
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
import {
  ArrowLeft,
  MonitorPlay,
  PlayCircle,
  Send,
  Sparkles,
} from "lucide-react";

import AppIcon from "./AppIcon";
import { BLOCO_META, resumoConfig } from "./blocoMeta";
import CasoBloco from "./CasoBloco";
import EnqueteBloco from "./EnqueteBloco";
import MaterialBloco from "./MaterialBloco";
import SessaoPanel from "./SessaoPanel";
import { useAula } from "@/hooks/useAulas";
import { useBlocos } from "@/hooks/useBlocos";
import { useSessaoAtual } from "@/hooks/useSessao";
import { useSessaoLive } from "@/hooks/useSessaoLive";
import type { EstadoSessao } from "@/services/sessao";
import type { Bloco } from "@/services/blocos";
import type { TipoBloco } from "@/services/blocos";
import { getAccessToken } from "@/utils/accessToken";

/**
 * Cockpit da sessão: a sequência salva, com as ações de cada bloco.
 * É aqui que o professor gera o conteúdo e conduz a aula.
 */
export default function AulaCockpitPage() {
  const { aulaId } = useParams<{ aulaId: string }>();
  const navigate = useNavigate();
  const { data: aula, isLoading: carregandoAula } = useAula(aulaId);
  const { data: blocos, isLoading: carregandoBlocos } = useBlocos(aulaId);

  // A sessão é consultada aqui (não no painel) para que os botões de cada bloco
  // compartilhem o mesmo estado ao vivo.
  const { data: sessaoRest, isLoading: carregandoSessao } =
    useSessaoAtual(aulaId);
  const live = useSessaoLive(sessaoRest?.codigo);
  const sessao = live.estado ?? sessaoRest ?? null;

  const carregando = carregandoAula || carregandoBlocos;

  /**
   * Abre as duas janelas de uma vez: a de controle (esta mesma navegação) e a
   * de projeção (pop-up), pra não precisar de um clique extra em "Abrir
   * projeção" lá dentro. `sessionStorage` é por aba — por isso o token vai
   * pela URL, igual ao botão "Abrir projeção" do modo apresentação.
   */
  const handleApresentar = () => {
    const token = getAccessToken();
    const urlProjecao = token
      ? `/aulas/${aulaId}/projetar?accessToken=${encodeURIComponent(token)}`
      : `/aulas/${aulaId}/projetar`;

    window.open(urlProjecao, "p360-projecao", "noopener,width=1280,height=720");
    navigate(`/aulas/${aulaId}/apresentar`);
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Box bg="white" px={{ base: 4, md: 8 }} pt="5" pb="4">
        <Flex
          as="button"
          align="center"
          gap="1"
          mb="1"
          color="gray.500"
          cursor="pointer"
          _hover={{ color: "gray.700" }}
          onClick={() => navigate("/")}
        >
          <AppIcon icon={ArrowLeft} size={14} />
          <Text fontSize="sm">Voltar</Text>
        </Flex>
        <Flex justify="space-between" align="flex-end" gap="3" wrap="wrap">
          <Box>
            <Heading size="lg" color="gray.900">
              {aula?.titulo ?? "Sessão de aula"}
            </Heading>
            <Text fontSize="sm" color="gray.500">
              Prepare os materiais aqui. Quem conduz a aula é o Apresentar — a
              liberação de cada bloco é automática ao avançar a etapa.
            </Text>
          </Box>
          <CustomButton
            variant="solid"
            icon={MonitorPlay}
            onClick={handleApresentar}
          >
            Apresentar
          </CustomButton>
        </Flex>
      </Box>

      <Box px={{ base: 4, md: 8 }} py="6">
        {carregando ? (
          <Text fontSize="sm" color="gray.500">
            Carregando…
          </Text>
        ) : !blocos || blocos.length === 0 ? (
          <Box
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderStyle="dashed"
            borderRadius="xl"
            p="10"
            textAlign="center"
          >
            <Text fontSize="sm" color="gray.500">
              Esta aula não tem blocos. Crie uma nova aula para montar a
              sequência.
            </Text>
          </Box>
        ) : (
          <Stack gap="4" maxW="1200px" mx="auto">
            <SessaoPanel
              aulaId={aulaId as string}
              estado={sessao}
              isLoading={carregandoSessao}
              conectados={live.conectados}
              conectado={live.conectado}
              erroLive={live.erro}
            />

            {blocos.map((bloco, index) => (
              <BlocoCard
                key={bloco.id}
                aulaId={aulaId as string}
                bloco={bloco}
                posicao={index + 1}
                sessao={sessao}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

interface BlocoCardProps {
  aulaId: string;
  bloco: Bloco;
  posicao: number;
  sessao: EstadoSessao | null;
}

function BlocoCard({ aulaId, bloco, posicao, sessao }: BlocoCardProps) {
  const meta = BLOCO_META[bloco.tipo as TipoBloco];
  const resumo = meta
    ? resumoConfig(bloco.tipo as TipoBloco, bloco.config)
    : null;

  const ehAtual = sessao?.blocoAtual?.id === bloco.id;
  const liberado = ehAtual && sessao?.estadoAtual === "liberado";

  const ehCaso = bloco.tipo === "caso";
  const ehMaterial = ["slides", "simulado", "resumo", "material_complementar"].includes(
    bloco.tipo,
  );

  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="xl"
      p={{ base: 4, md: 5 }}
    >
      <Flex align="flex-start" gap="3" mb="4">
        <Flex
          w="26px"
          h="26px"
          flexShrink={0}
          align="center"
          justify="center"
          borderRadius="full"
          bg="gray.100"
          color="gray.600"
          fontSize="xs"
          fontWeight="semibold"
        >
          {posicao}
        </Flex>
        {meta && (
          <AppIcon icon={meta.icon} size={20} color={`${meta.color}.500`} />
        )}
        <Box minW="0" flex="1">
          <Heading size="sm" color="gray.900">
            {meta?.titulo ?? bloco.tipo}
          </Heading>
          <Text fontSize="xs" color="gray.500">
            {resumo ?? meta?.descricao}
          </Text>
        </Box>
        <HStack gap="2">
          {liberado && (
            <Badge
              variant="solid"
              colorPalette="green"
              borderRadius="full"
              px="2.5"
              fontSize="2xs"
            >
              liberado
            </Badge>
          )}
          <EstadoBadge bloco={bloco} />
        </HStack>
      </Flex>

      {bloco.tipo === "enquete" && (
        <EnqueteBloco aulaId={aulaId} bloco={bloco} />
      )}

      {ehCaso && (
        <CasoBloco
          aulaId={aulaId}
          bloco={bloco}
          sessao={sessao}
          liberado={liberado}
        />
      )}

      {ehMaterial && (
        <MaterialBloco
          aulaId={aulaId}
          bloco={bloco}
          tipo={
            bloco.tipo as "slides" | "simulado" | "resumo" | "material_complementar"
          }
          liberado={liberado}
        />
      )}

      {bloco.tipo === "reforco" && (
        <Text fontSize="xs" color="gray.400" mt="3" pl="12">
          {meta?.titulo} — em construção.
        </Text>
      )}
    </Box>
  );
}

/** Estado do bloco derivado do `output` (rascunho → publicado → ao vivo). */
function EstadoBadge({ bloco }: { bloco: Bloco }) {
  const output = bloco.output ?? {};

  const estado = output.accessPin
    ? { label: "Ao vivo", color: "green", icon: PlayCircle }
    : output.poll360PackageId
      ? { label: "Publicada", color: "blue", icon: Send }
      : Array.isArray(output.perguntas) && output.perguntas.length > 0
        ? { label: "Rascunho", color: "orange", icon: Sparkles }
        : null;

  if (!estado) return null;

  return (
    <HStack gap="1">
      <Badge
        variant="subtle"
        colorPalette={estado.color}
        borderRadius="full"
        px="2.5"
        py="0.5"
        fontSize="xs"
      >
        {estado.label}
      </Badge>
    </HStack>
  );
}
