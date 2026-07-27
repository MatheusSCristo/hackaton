import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Tabs,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import {
  ArrowLeft,
  BarChart3,
  Files,
  MonitorPlay,
  Presentation,
  Save,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import AppIcon from "./AppIcon";
import CriarTab from "./tabs/CriarTab";
import MateriaisTab from "./tabs/MateriaisTab";
import { useCriarAula } from "@/hooks/useAulas";
import { useAulaStore } from "@/store/aulaStore";

interface TabDef {
  value: string;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { value: "criar", label: "1. Criar", icon: Wand2 },
  { value: "materiais", label: "2. Materiais", icon: Files },
  { value: "apresentacao", label: "3. Apresentação", icon: Presentation },
  { value: "modo-sala", label: "4. Modo sala", icon: MonitorPlay },
  { value: "impacto", label: "5. Impacto", icon: BarChart3 },
];

function EmBreve({ label }: { label: string }) {
  return (
    <Flex
      minH="320px"
      align="center"
      justify="center"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderStyle="dashed"
      borderRadius="xl"
    >
      <Text color="gray.400" fontSize="sm">
        {label.replace(/^\d+\.\s*/, "")} — em construção
      </Text>
    </Flex>
  );
}

export default function AulaConectadaPage() {
  const [tab, setTab] = useState("criar");
  const navigate = useNavigate();
  const criar = useCriarAula();
  const {
    mode,
    selectedCaseId,
    selectedCaseTitulo,
    tema,
    publico,
    duracao,
    formato,
    objetivos,
    blocos,
    reset,
  } = useAulaStore();

  const podeSalvar = Boolean(selectedCaseId) || tema.trim().length > 0;

  const handleSalvar = () => {
    criar.mutate(
      {
        modo: mode,
        casoLegacyId: selectedCaseId ? Number(selectedCaseId) : undefined,
        casoTitulo: selectedCaseTitulo ?? undefined,
        tema: tema.trim() || undefined,
        publico: publico || undefined,
        duracao: duracao || undefined,
        formato: formato || undefined,
        objetivos: objetivos || undefined,
        // A ordem do array é a ordem da sessão.
        blocos: blocos.map((bloco) => ({
          tipo: bloco.tipo,
          config: bloco.config,
        })),
      },
      {
        onSuccess: (aula) => {
          reset();
          // Vai direto ao cockpit: é lá que o professor gera o conteúdo dos
          // blocos e conduz a sessão.
          navigate(`/aulas/${aula.id}`);
        },
      },
    );
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Tabs.Root
        value={tab}
        onValueChange={(e) => setTab(e.value)}
        variant="line"
      >
        {/* Cabeçalho + abas sobre fundo branco */}
        <Box bg="white">
          <Flex
            justify="space-between"
            align="flex-start"
            gap="4"
            wrap="wrap"
            px={{ base: 4, md: 8 }}
            pt="5"
            pb="4"
          >
            <Box>
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
              <Heading size="lg" color="gray.900">
                Aula conectada
              </Heading>
              <Text fontSize="sm" color="gray.500">
                Professor e aluno no mesmo caso. Dados que mostram resultado.
              </Text>
            </Box>
            <HStack gap="2">
              <CustomButton
                variant="solid"
                icon={Save}
                size="sm"
                isLoading={criar.isPending}
                disabled={!podeSalvar}
                onClick={handleSalvar}
              >
                Salvar aula
              </CustomButton>
              <Badge
                colorPalette="purple"
                variant="subtle"
                borderRadius="full"
                px="3"
                py="1"
              >
                Premium Academia
              </Badge>
            </HStack>
          </Flex>

          <Tabs.List px={{ base: 2, md: 6 }}>
            {TABS.map((t) => (
              <Tabs.Trigger key={t.value} value={t.value}>
                <Flex align="center" gap="2">
                  <AppIcon icon={t.icon} size={16} />
                  {t.label}
                </Flex>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Box>

        {/* Conteúdo sobre fundo cinza */}
        <Box px={{ base: 4, md: 8 }} py="6">
          <Tabs.Content value="criar">
            <CriarTab onNext={() => setTab("materiais")} />
          </Tabs.Content>
          <Tabs.Content value="materiais">
            <MateriaisTab onNext={() => setTab("apresentacao")} />
          </Tabs.Content>
          {TABS.filter(
            (t) => t.value !== "criar" && t.value !== "materiais",
          ).map((t) => (
            <Tabs.Content key={t.value} value={t.value}>
              <EmBreve label={t.label} />
            </Tabs.Content>
          ))}
        </Box>
      </Tabs.Root>
    </Box>
  );
}
