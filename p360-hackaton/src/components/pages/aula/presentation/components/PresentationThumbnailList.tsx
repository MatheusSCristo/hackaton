import { useMemo, useState } from "react";
import { Box, HStack, IconButton, Stack, Text } from "@cursosactive/p360-new-ui";
import { ChevronDown, ChevronUp } from "lucide-react";

import type { Apresentacao } from "@/services/materiais";
import { PresentationRenderer } from "./PresentationRenderer";

interface PresentationThumbnailListProps {
  presentation: Apresentacao;
  activeIndex: number;
  onSelect: (index: number) => void;
}

const MAX_VISIBLE_SLIDES = 4;

/** Portado do `projeto-hackathon` (`PresentationThumbnailList.tsx`) sem alterações de lógica. */
export function PresentationThumbnailList({
  presentation,
  activeIndex,
  onSelect,
}: PresentationThumbnailListProps) {
  const [startIndex, setStartIndex] = useState(0);
  const slides = presentation.slides;

  const visibleSlides = useMemo(
    () =>
      slides
        .slice(startIndex, startIndex + MAX_VISIBLE_SLIDES)
        .map((slide, offset) => ({ slide, index: startIndex + offset })),
    [slides, startIndex],
  );

  const canGoUp = startIndex > 0;
  const canGoDown = startIndex + MAX_VISIBLE_SLIDES < slides.length;

  return (
    <Stack gap={2} w={{ base: "140px", md: "220px" }} flexShrink={0}>
      {canGoUp && (
        <IconButton
          aria-label="Slides anteriores"
          variant="ghost"
          size="sm"
          alignSelf="center"
          color="gray.400"
          onClick={() => setStartIndex((i) => i - 1)}
        >
          <ChevronUp size={18} />
        </IconButton>
      )}

      <Stack gap={3}>
        {visibleSlides.map(({ index }) => (
          <HStack key={index} align="center" gap={3} cursor="pointer" onClick={() => onSelect(index)}>
            <Text
              fontWeight="bold"
              fontSize="lg"
              color={index === activeIndex ? "blue.600" : "gray.400"}
              minW="1.8em"
              textAlign="center"
              lineHeight={1}
              flexShrink={0}
            >
              {index + 1}
            </Text>

            <Box
              flex={1}
              borderWidth="2px"
              borderColor={index === activeIndex ? "blue.500" : "transparent"}
              borderRadius="md"
              overflow="hidden"
              boxShadow={index === activeIndex ? "md" : "xs"}
              transition="all 0.15s ease"
            >
              <PresentationRenderer presentation={presentation} slideIndex={index} />
            </Box>
          </HStack>
        ))}
      </Stack>

      {canGoDown && (
        <IconButton
          aria-label="Próximos slides"
          variant="ghost"
          size="sm"
          alignSelf="center"
          color="gray.400"
          onClick={() => setStartIndex((i) => i + 1)}
        >
          <ChevronDown size={18} />
        </IconButton>
      )}
    </Stack>
  );
}
