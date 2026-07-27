import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
  CustomButton,
} from "@cursosactive/p360-new-ui";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useSlidesAluno } from "@/hooks/useMateriais";

interface SlidesAlunoProps {
  sessaoId: string;
  blocoId: string;
}

/**
 * Slides na sala do aluno, com **navegação livre**: ele anda no próprio ritmo,
 * independente do slide que o professor está mostrando.
 */
export default function SlidesAluno({ sessaoId, blocoId }: SlidesAlunoProps) {
  const { data, isLoading, error } = useSlidesAluno(sessaoId, blocoId);
  const [indice, setIndice] = useState(0);

  const total = data?.slides.length ?? 0;

  // Se os slides forem regerados, o índice antigo pode não existir mais.
  useEffect(() => {
    if (indice >= total && total > 0) setIndice(0);
  }, [indice, total]);

  // Setas do teclado: navegar slides é a interação principal aqui.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [total]);

  if (isLoading) {
    return (
      <Flex justify="center" py="10">
        <Spinner color="blue.500" />
      </Flex>
    );
  }

  if (error || !data || total === 0) {
    return (
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
          Os slides ainda não estão disponíveis.
        </Text>
      </Box>
    );
  }

  const slide = data.slides[Math.min(indice, total - 1)];
  const ehCapa = slide.role !== "development";

  return (
    <Stack gap="3">
      {/* Palco do slide: proporção 16:9, como no PPTX. */}
      <Box
        bg={ehCapa ? "gray.900" : "white"}
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="xl"
        overflow="hidden"
        aspectRatio="16 / 9"
        p={{ base: 5, md: 8 }}
        display="flex"
        flexDirection="column"
        justifyContent={ehCapa ? "center" : "flex-start"}
      >
        <Heading
          size={{ base: "md", md: "lg" }}
          color={ehCapa ? "white" : "gray.900"}
          lineHeight="1.2"
        >
          {slide.title}
        </Heading>

        <Box w="48px" h="3px" bg="red.500" borderRadius="full" my="3" />

        {slide.subtitle && (
          <Text
            fontSize={{ base: "sm", md: "md" }}
            color={ehCapa ? "cyan.300" : "gray.500"}
            mb="2"
          >
            {slide.subtitle}
          </Text>
        )}

        {slide.content.length > 0 && (
          <Stack gap="2.5" mt="1">
            {slide.content.map((bullet, i) => (
              <Flex key={i} gap="2.5" align="flex-start">
                <Box
                  w="6px"
                  h="6px"
                  mt="8px"
                  flexShrink={0}
                  borderRadius="full"
                  bg="red.500"
                />
                <Text
                  fontSize={{ base: "sm", md: "md" }}
                  color="gray.700"
                  lineHeight="1.5"
                >
                  {bullet}
                </Text>
              </Flex>
            ))}
          </Stack>
        )}
      </Box>

      {/* Controles */}
      <Flex justify="space-between" align="center" gap="3" wrap="wrap">
        <HStack gap="2">
          <CustomButton
            variant="outline"
            icon={ChevronLeft}
            size="sm"
            disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(i - 1, 0))}
          >
            Anterior
          </CustomButton>
          <CustomButton
            variant="solid"
            icon={ChevronRight}
            size="sm"
            disabled={indice >= total - 1}
            onClick={() => setIndice((i) => Math.min(i + 1, total - 1))}
          >
            Próximo
          </CustomButton>
        </HStack>

        <Text fontSize="xs" color="gray.500">
          {indice + 1} de {total} · use ← →
        </Text>
      </Flex>
    </Stack>
  );
}
