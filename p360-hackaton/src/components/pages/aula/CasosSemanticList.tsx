import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@cursosactive/p360-new-ui";
import { Sparkles } from "lucide-react";

import AppIcon from "./AppIcon";
import CasoCard from "./CasoCard";
import { SEMANTIC_MIN_CHARS, useSemanticCasos } from "@/hooks/useSemanticCasos";

interface CasosSemanticListProps {
  /** Tema cru (debounced internamente). */
  tema: string;
  selectedId: string | null;
  onSelect: (id: string, titulo: string) => void;
}

/**
 * Lista de casos ranqueada semanticamente por tema (via Claude). Sem
 * paginação — mostra o top-K ordenado por relevância.
 */
export default function CasosSemanticList({
  tema,
  selectedId,
  onSelect,
}: CasosSemanticListProps) {
  const [debounced, setDebounced] = useState(tema.trim());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(tema.trim()), 400);
    return () => clearTimeout(timer);
  }, [tema]);

  const { data, isLoading, isError } = useSemanticCasos(debounced);
  const items = data?.items ?? [];

  if (debounced.length < SEMANTIC_MIN_CHARS) {
    return (
      <Box
        borderWidth="1px"
        borderColor="gray.200"
        borderStyle="dashed"
        borderRadius="lg"
        p="6"
        textAlign="center"
      >
        <Text fontSize="sm" color="gray.500">
          Digite ao menos {SEMANTIC_MIN_CHARS} letras para a IA sugerir casos.
        </Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Flex justify="center" align="center" gap="2" py="10">
        <Spinner color="blue.500" />
        <Text fontSize="sm" color="gray.500">
          A IA está selecionando os casos…
        </Text>
      </Flex>
    );
  }

  if (isError) {
    return (
      <Text fontSize="sm" color="red.500">
        Não foi possível buscar os casos agora. Tente novamente.
      </Text>
    );
  }

  if (items.length === 0) {
    return (
      <Box
        borderWidth="1px"
        borderColor="gray.200"
        borderStyle="dashed"
        borderRadius="lg"
        p="6"
        textAlign="center"
      >
        <Text fontSize="sm" color="gray.500">
          Nenhum caso do acervo se encaixou nesse tema.
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap="3">
      <HStack gap="1.5" color="blue.600">
        <AppIcon icon={Sparkles} size={14} color="blue.500" />
        <Text fontSize="xs" fontWeight="medium">
          {data?.semantic
            ? "Casos sugeridos pela IA para esse tema"
            : "Resultados por busca textual"}
        </Text>
      </HStack>
      <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} gap="3">
        {items.map((caso) => (
          <CasoCard
            key={caso.id}
            caso={caso}
            selected={caso.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
