import { useMemo } from "react";
import { AspectRatio, Box, Image } from "@cursosactive/p360-new-ui";

import type { Apresentacao, SlideGerado } from "@/services/materiais";
import heroBackground from "@/assets/start-end-bg.png";
import {
  BODY_FONT_SIZE_TIERS,
  DEVELOPMENT_LAYOUT,
  HERO_LAYOUT,
  PALETTE,
  TITLE_FONT_SIZE_TIERS,
} from "../presentation-layout";
import { fitBulletsToBox } from "../text-fit";
import "../presentation-transitions.css";

interface PresentationRendererProps {
  presentation: Apresentacao;
  slideIndex: number;
  /**
   * Preenche 100% do container do jeito que ele estiver (sem travar em
   * 16:9) — usado na projeção em tela cheia, onde o monitor pode ter outra
   * proporção e sobrariam barras pretas se mantivéssemos o letterbox do
   * preview normal (cockpit/controle).
   */
  fill?: boolean;
}

/**
 * Renderiza um slide — portado do `projeto-hackathon`
 * (`shared/presentation/components/PresentationRenderer.tsx`). Capa/fechamento
 * usam a mesma imagem de fundo do PPTX gerado no backend (`start-end-bg.png`,
 * empacotada localmente — o preview não depende do backend servir estático).
 */
export function PresentationRenderer({ presentation, slideIndex, fill }: PresentationRendererProps) {
  const slide = presentation.slides[slideIndex];
  const isHero = slide.role !== "development";

  const conteudo = (
    <Box
      key={slideIndex}
      className="p360-slide-transition"
      position="relative"
      overflow="hidden"
      w="full"
      h="full"
      bg={isHero ? PALETTE.title : "white"}
      backgroundImage={isHero ? `url(${heroBackground})` : undefined}
      backgroundSize="cover"
      backgroundPosition="center"
    >
      {isHero ? (
        <HeroSlideView slide={slide} apresentacao={presentation} />
      ) : (
        <DevelopmentSlideView slide={slide} slideNumber={slideIndex} />
      )}
    </Box>
  );

  if (fill) {
    return (
      <Box w="full" h="full" style={{ containerType: "inline-size" }}>
        {conteudo}
      </Box>
    );
  }

  return (
    <AspectRatio ratio={16 / 9} w="full" h="full" style={{ containerType: "inline-size" }}>
      {conteudo}
    </AspectRatio>
  );
}

function HeroSlideView({ slide, apresentacao }: { slide: SlideGerado; apresentacao: Apresentacao }) {
  const titulo = slide.title || apresentacao.title;
  const subtitulo = slide.subtitle ?? apresentacao.subtitle;

  const titleFontSize = useMemo(
    () =>
      fitBulletsToBox(
        [titulo],
        { widthIn: HERO_LAYOUT.title.boxWidthIn, heightIn: HERO_LAYOUT.title.boxHeightIn },
        TITLE_FONT_SIZE_TIERS,
      ),
    [titulo],
  );

  return (
    <>
      <Box
        position="absolute"
        left={HERO_LAYOUT.title.left}
        top={HERO_LAYOUT.title.top}
        width={HERO_LAYOUT.title.width}
        height={HERO_LAYOUT.title.height}
        display="flex"
        alignItems="flex-end"
        fontWeight="bold"
        color="white"
        lineHeight="1.1"
        overflow="hidden"
        style={{ fontSize: titleFontSize }}
      >
        {titulo}
      </Box>

      <Box
        position="absolute"
        left={HERO_LAYOUT.accentLine.left}
        top={HERO_LAYOUT.accentLine.top}
        width={HERO_LAYOUT.accentLine.width}
        height={HERO_LAYOUT.accentLine.height}
        bg={PALETTE.brandRed}
        borderRadius="full"
      />

      {subtitulo && (
        <Box
          position="absolute"
          left={HERO_LAYOUT.subtitle.left}
          top={HERO_LAYOUT.subtitle.top}
          width={HERO_LAYOUT.subtitle.width}
          height={HERO_LAYOUT.subtitle.height}
          color={PALETTE.brandTeal}
          fontWeight="medium"
          style={{ fontSize: "2.4cqw" }}
        >
          {subtitulo}
        </Box>
      )}
    </>
  );
}

function DevelopmentSlideView({ slide, slideNumber }: { slide: SlideGerado; slideNumber: number }) {
  const hasImage = Boolean(slide.visual?.imageUrl);
  const contentWidth = hasImage ? DEVELOPMENT_LAYOUT.textWidth : DEVELOPMENT_LAYOUT.fullWidth;
  const contentWidthIn = hasImage ? DEVELOPMENT_LAYOUT.textWidthIn : DEVELOPMENT_LAYOUT.fullWidthIn;

  const titleFontSize = useMemo(
    () =>
      fitBulletsToBox(
        [slide.title],
        { widthIn: contentWidthIn, heightIn: DEVELOPMENT_LAYOUT.title.boxHeightIn },
        TITLE_FONT_SIZE_TIERS,
      ),
    [slide.title, contentWidthIn],
  );

  const bodyFontSize = useMemo(
    () =>
      fitBulletsToBox(
        slide.content,
        { widthIn: contentWidthIn, heightIn: DEVELOPMENT_LAYOUT.contentRow.boxHeightIn },
        BODY_FONT_SIZE_TIERS,
      ),
    [slide.content, contentWidthIn],
  );

  return (
    <>
      <Box
        position="absolute"
        left={DEVELOPMENT_LAYOUT.leftMargin}
        top={DEVELOPMENT_LAYOUT.title.top}
        width={contentWidth}
        height={DEVELOPMENT_LAYOUT.title.height}
        display="flex"
        alignItems="flex-end"
        fontWeight="bold"
        color={PALETTE.title}
        lineHeight="1.1"
        overflow="hidden"
        style={{ fontSize: titleFontSize }}
      >
        {slide.title}
      </Box>

      <Box
        position="absolute"
        left={DEVELOPMENT_LAYOUT.leftMargin}
        top={DEVELOPMENT_LAYOUT.accentLine.top}
        width={DEVELOPMENT_LAYOUT.accentLine.width}
        height={DEVELOPMENT_LAYOUT.accentLine.height}
        bg={PALETTE.brandRed}
        borderRadius="full"
      />

      <Box
        position="absolute"
        left={DEVELOPMENT_LAYOUT.leftMargin}
        top={DEVELOPMENT_LAYOUT.contentRow.top}
        width={contentWidth}
        height={DEVELOPMENT_LAYOUT.contentRow.height}
        display="flex"
        flexDirection="column"
        justifyContent="center"
        overflow="hidden"
        style={{ fontSize: bodyFontSize }}
      >
        {slide.content.map((bullet) => (
          <Box key={bullet} display="flex" alignItems="flex-start" mb="0.6em">
            <Box
              as="span"
              color={PALETTE.brandRed}
              fontWeight="bold"
              mr="0.5em"
              style={{ fontSize: `${DEVELOPMENT_LAYOUT.bulletFontSizeRatio}em` }}
            >
              •
            </Box>
            <Box as="span" color={PALETTE.body}>
              {bullet}
            </Box>
          </Box>
        ))}
      </Box>

      {slide.visual?.imageUrl && (
        <Box
          position="absolute"
          left={DEVELOPMENT_LAYOUT.imageLeft}
          top={DEVELOPMENT_LAYOUT.contentRow.top}
          width={DEVELOPMENT_LAYOUT.imageWidth}
          height={DEVELOPMENT_LAYOUT.contentRow.height}
          overflow="hidden"
          borderRadius={DEVELOPMENT_LAYOUT.imageCornerRadius}
        >
          <Image
            src={slide.visual.imageUrl}
            alt={slide.visual.keyword}
            w="full"
            h="full"
            objectFit="cover"
          />
        </Box>
      )}

      <Box position="absolute" right="4%" bottom="3%" color={PALETTE.muted} style={{ fontSize: "1.1cqw" }}>
        {slideNumber + 1}
      </Box>
    </>
  );
}
