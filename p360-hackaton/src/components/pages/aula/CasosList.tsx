import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@cursosactive/p360-new-ui";

import CasoCard from "./CasoCard";
import { CASOS_PAGE_SIZE, useSearchCasos } from "@/hooks/useSearchCasos";

interface CasosListProps {
  /** Termo de busca cru (debounced internamente). */
  term: string;
  selectedId: string | null;
  onSelect: (id: string, titulo: string) => void;
  emptyHint: string;
}

/** Lista paginada de casos do acervo, com debounce do termo e navegação. */
export default function CasosList({
  term,
  selectedId,
  onSelect,
  emptyHint,
}: CasosListProps) {
  const [debounced, setDebounced] = useState(term.trim());
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  // Filtra só com 3+ letras; abaixo disso, mostra o catálogo completo.
  const effectiveTerm = debounced.length >= 3 ? debounced : "";

  // Volta pra primeira página sempre que o termo efetivo muda.
  useEffect(() => {
    setPage(1);
  }, [effectiveTerm]);

  const { data, isLoading, isError } = useSearchCasos(effectiveTerm, page);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CASOS_PAGE_SIZE));

  if (isLoading) {
    return (
      <Flex justify="center" py="10">
        <Spinner color="blue.500" />
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
          {emptyHint}
        </Text>
      </Box>
    );
  }

  return (
    <Stack gap="3">
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

      {totalPages > 1 && (
        <Flex justify="space-between" align="center" pt="1">
          <Text fontSize="xs" color="gray.500">
            {total} casos · página {page} de {totalPages}
          </Text>
          <HStack gap="2">
            <Button
              size="xs"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </Button>
          </HStack>
        </Flex>
      )}
    </Stack>
  );
}
