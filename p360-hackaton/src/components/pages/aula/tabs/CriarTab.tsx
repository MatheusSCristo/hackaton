import { useState } from "react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Text,
  CustomButton,
  CustomInput,
  CustomSelect,
  CustomTextarea,
} from "@cursosactive/p360-new-ui";
import { ArrowRight, Compass } from "lucide-react";

import AppIcon from "../AppIcon";
import CasoCard from "../CasoCard";
import CasosList from "../CasosList";
import CasosSemanticList from "../CasosSemanticList";
import { casos, duracaoOptions, formatoOptions, publicoOptions } from "../data";
import Environment from "@/config/env";
import { useAulaStore } from "@/store/aulaStore";

const fieldLabelProps = {
  fontSize: "sm",
  fontWeight: "medium",
  color: "gray.600",
  mb: "1.5",
} as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text {...fieldLabelProps}>{children}</Text>;
}

interface CriarTabProps {
  onNext?: () => void;
}

export default function CriarTab({ onNext }: CriarTabProps) {
  const {
    mode,
    selectedCaseId,
    tema,
    publico,
    duracao,
    formato,
    objetivos,
    setMode,
    selectCase,
    setField,
  } = useAulaStore();

  const useMock = Environment.VITE_USE_MOCK;
  // Busca própria do modo "caso" (independente do campo de tema).
  const [buscaCaso, setBuscaCaso] = useState("");

  // Em modo mock, renderiza os casos de exemplo sem busca/paginação.
  const mockList = (
    <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3">
      {casos.map((caso) => (
        <CasoCard
          key={caso.id}
          caso={caso}
          selected={selectedCaseId === caso.id}
          onSelect={selectCase}
        />
      ))}
    </SimpleGrid>
  );

  return (
    <>
      <Box
        bg="white"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        p={{ base: 4, md: 6 }}
      >
        <Stack gap="5" align="stretch">
          <Flex align="center" gap="2">
            <AppIcon icon={Compass} size={18} color="gray.700" />
            <Heading size="sm" color="gray.800">
              Escolha o ponto de partida
            </Heading>
          </Flex>

          <HStack gap="2">
            <CustomButton
              variant={mode === "caso" ? "solid" : "outline"}
              size="sm"
              onClick={() => setMode("caso")}
            >
              Começar pelo caso clínico
            </CustomButton>
            <CustomButton
              variant={mode === "tema" ? "solid" : "outline"}
              size="sm"
              onClick={() => setMode("tema")}
            >
              Começar pelo tema
            </CustomButton>
          </HStack>

          {mode === "caso" ? (
            /* Modo caso: busca + listagem paginada do acervo da empresa. */
            <Box>
              <SectionLabel>
                Selecione o caso do acervo Paciente 360
              </SectionLabel>
              <Box mb="3">
                <CustomInput
                  variant="search"
                  value={buscaCaso}
                  onChange={setBuscaCaso}
                  placeholder="Buscar por título, especialidade ou tema..."
                />
              </Box>
              {useMock ? (
                mockList
              ) : (
                <CasosList
                  term={buscaCaso}
                  selectedId={selectedCaseId}
                  onSelect={selectCase}
                  emptyHint="Nenhum caso encontrado no acervo da sua empresa."
                />
              )}
            </Box>
          ) : (
            /* Modo tema: descreve o tema; resultados aparecem abaixo. */
            <Box>
              <SectionLabel>Descreva o tema</SectionLabel>
              <CustomInput
                variant="text"
                value={tema}
                onChange={(value) => setField("tema", value)}
                placeholder="Ex.: Insuficiência cardíaca, sepse, cetoacidose..."
              />
              <Box mt="3">
                {tema.trim() ? (
                  useMock ? (
                    mockList
                  ) : (
                    <CasosSemanticList
                      tema={tema}
                      selectedId={selectedCaseId}
                      onSelect={selectCase}
                    />
                  )
                ) : (
                  <Box
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderStyle="dashed"
                    borderRadius="lg"
                    p="6"
                    textAlign="center"
                  >
                    <Text fontSize="sm" color="gray.500">
                      Descreva um tema acima para ver os casos sugeridos do
                      acervo.
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
            <CustomSelect
              label="Público-alvo"
              placeholder="Selecione"
              value={publico}
              options={publicoOptions}
              onChange={(value) => setField("publico", value)}
            />
            <CustomSelect
              label="Duração da aula"
              placeholder="Selecione"
              value={duracao}
              options={duracaoOptions}
              onChange={(value) => setField("duracao", value)}
            />
            <CustomSelect
              label="Formato"
              placeholder="Selecione"
              value={formato}
              options={formatoOptions}
              onChange={(value) => setField("formato", value)}
            />
          </SimpleGrid>

          <CustomTextarea
            label="Objetivos de aprendizagem"
            value={objetivos}
            onChange={(value) => setField("objetivos", value)}
          />
        </Stack>
      </Box>

      {/* ---------------- Ações ---------------- */}
      <Flex justify="flex-end" mt="6">
        <CustomButton variant="solid" icon={ArrowRight} onClick={onNext}>
          Próxima etapa
        </CustomButton>
      </Flex>
    </>
  );
}
