import { Box, Flex } from "@cursosactive/p360-new-ui";

import type { Apresentacao } from "@/services/materiais";
import { usePresentationNavigation } from "../hooks/usePresentationNavigation";
import { PresentationRenderer } from "./PresentationRenderer";
import { PresentationThumbnailList } from "./PresentationThumbnailList";

interface PresentationViewerProps {
  presentation: Apresentacao;
  /**
   * Navegação controlada de fora (ex.: `ApresentarPage`, que sincroniza o
   * slide atual com a projeção). Sem isso, o viewer cuida do próprio índice
   * internamente — é o caso do preview no cockpit.
   */
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
}

/**
 * Visualizador de slides de verdade (imagem real, miniaturas, fullscreen) —
 * adaptado do `projeto-hackathon` (`PresentationViewer.tsx`). Aqui é só o
 * viewer puro: download/publicação ficam nos botões que já existem em
 * `MaterialBloco`, então não duplicamos essa responsabilidade aqui.
 */
export function PresentationViewer({
  presentation,
  activeIndex,
  onIndexChange,
}: PresentationViewerProps) {
  const navegacaoInterna = usePresentationNavigation(presentation.slides.length);
  const controlado = activeIndex !== undefined && onIndexChange !== undefined;

  const navigation = controlado
    ? {
        index: activeIndex,
        totalSlides: presentation.slides.length,
        isFirst: activeIndex === 0,
        isLast: activeIndex >= presentation.slides.length - 1,
        goTo: onIndexChange,
        next: () =>
          onIndexChange(Math.min(activeIndex + 1, presentation.slides.length - 1)),
        previous: () => onIndexChange(Math.max(activeIndex - 1, 0)),
      }
    : navegacaoInterna;

  return (
    <Box>
      <Flex gap={4} align="flex-start">
        <PresentationThumbnailList
          presentation={presentation}
          activeIndex={navigation.index}
          onSelect={navigation.goTo}
        />

        <Box flex={1} position="relative" borderRadius="xl" overflow="hidden" boxShadow="sm">
          <PresentationRenderer presentation={presentation} slideIndex={navigation.index} />
        </Box>
      </Flex>
    </Box>
  );
}
