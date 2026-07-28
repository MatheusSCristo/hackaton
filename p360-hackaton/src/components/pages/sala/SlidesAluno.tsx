import { Box, Flex, Spinner, Text } from "@cursosactive/p360-new-ui";

import { useSlidesAluno } from "@/hooks/useMateriais";
import { PresentationRenderer } from "../aula/presentation";

interface SlidesAlunoProps {
  sessaoId: string;
  blocoId: string;
  /** Slide que o professor está mostrando agora — espelhado, sem navegação própria do aluno. */
  slideAtual: number;
}

/**
 * Slides na sala do aluno — **espelhados**: o aluno vê exatamente o slide que
 * o professor está mostrando, sem controles próprios de navegação (mudou de
 * "navegação livre" pra espelhamento em tempo real).
 */
export default function SlidesAluno({ sessaoId, blocoId, slideAtual }: SlidesAlunoProps) {
  const { data, isLoading, error } = useSlidesAluno(sessaoId, blocoId);
  const total = data?.slides.length ?? 0;

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

  const indice = Math.min(slideAtual, total - 1);

  return (
    <Box borderRadius="xl" overflow="hidden" boxShadow="sm">
      <PresentationRenderer presentation={data} slideIndex={indice} />
    </Box>
  );
}
