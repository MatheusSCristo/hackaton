/**
 * Constantes de layout do visualizador de slides — portadas do
 * `projeto-hackathon` (`shared/presentation/presentation-layout.ts`).
 *
 * Diferença: os slides de capa/fechamento aqui usam cor sólida (mesma da
 * capa do PPTX renderizado no backend), não uma imagem de fundo — o backend
 * não serve esse asset como HTTP estático.
 */
export const PALETTE = {
  brandRed: "#E4383E",
  brandTeal: "#62C4CE",
  title: "#1F2A37",
  body: "#3A4A58",
  muted: "#8492A0",
};

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

function cqw(value: number, total: number): string {
  return `${(value / total) * 100}cqw`;
}

const SLIDE_WIDTH_IN = 10;
const SLIDE_HEIGHT_IN = 5.625;

const HERO_SAFE_ZONE = { x: 0.6, width: 5.6 };
const HERO_TITLE_H = 0.75;
const HERO_LINE_GAP = 0.12;
const HERO_LINE_H = 0.03;
const HERO_SUBTITLE_H = 0.4;
const HERO_BLOCK_H =
  HERO_TITLE_H + HERO_LINE_GAP + HERO_LINE_H + HERO_LINE_GAP + HERO_SUBTITLE_H;
const HERO_SAFE_TOP = 2.0;
const HERO_SAFE_HEIGHT = 2.3;
const HERO_BLOCK_TOP = HERO_SAFE_TOP + (HERO_SAFE_HEIGHT - HERO_BLOCK_H) / 2;

export const HERO_LAYOUT = {
  title: {
    left: pct(HERO_SAFE_ZONE.x, SLIDE_WIDTH_IN),
    width: pct(HERO_SAFE_ZONE.width, SLIDE_WIDTH_IN),
    top: pct(HERO_BLOCK_TOP, SLIDE_HEIGHT_IN),
    height: pct(HERO_TITLE_H, SLIDE_HEIGHT_IN),
    boxWidthIn: HERO_SAFE_ZONE.width,
    boxHeightIn: HERO_TITLE_H,
  },
  accentLine: {
    left: pct(HERO_SAFE_ZONE.x, SLIDE_WIDTH_IN),
    top: pct(HERO_BLOCK_TOP + HERO_TITLE_H + HERO_LINE_GAP, SLIDE_HEIGHT_IN),
    width: pct(0.55, SLIDE_WIDTH_IN),
    height: cqw(HERO_LINE_H, SLIDE_HEIGHT_IN),
  },
  subtitle: {
    left: pct(HERO_SAFE_ZONE.x, SLIDE_WIDTH_IN),
    width: pct(HERO_SAFE_ZONE.width, SLIDE_WIDTH_IN),
    top: pct(
      HERO_BLOCK_TOP + HERO_TITLE_H + HERO_LINE_GAP + HERO_LINE_H + HERO_LINE_GAP,
      SLIDE_HEIGHT_IN,
    ),
    height: pct(HERO_SUBTITLE_H, SLIDE_HEIGHT_IN),
  },
};

const DEV_TOP_MARGIN = 0.55;
const DEV_TITLE_H = 0.9;
const DEV_LINE_GAP = 0.12;
const DEV_LINE_H = 0.025;
const DEV_CONTENT_GAP = 0.18;
const DEV_BOTTOM_MARGIN = 0.5;
const DEV_TITLE_Y = DEV_TOP_MARGIN;
const DEV_LINE_Y = DEV_TITLE_Y + DEV_TITLE_H + DEV_LINE_GAP;
const DEV_CONTENT_Y = DEV_LINE_Y + DEV_LINE_H + DEV_CONTENT_GAP;
const DEV_CONTENT_H = SLIDE_HEIGHT_IN - DEV_BOTTOM_MARGIN - DEV_CONTENT_Y;

const DEV_LEFT_MARGIN = 0.6;
const DEV_TEXT_WIDTH = 5.6;
const DEV_IMAGE_WIDTH = 3.2;
const DEV_COLUMN_GAP = 0.4;

export const DEVELOPMENT_LAYOUT = {
  leftMargin: pct(DEV_LEFT_MARGIN, SLIDE_WIDTH_IN),
  textWidth: pct(DEV_TEXT_WIDTH, SLIDE_WIDTH_IN),
  imageWidth: pct(DEV_IMAGE_WIDTH, SLIDE_WIDTH_IN),
  imageLeft: pct(DEV_LEFT_MARGIN + DEV_TEXT_WIDTH + DEV_COLUMN_GAP, SLIDE_WIDTH_IN),
  fullWidth: pct(DEV_TEXT_WIDTH + DEV_COLUMN_GAP + DEV_IMAGE_WIDTH, SLIDE_WIDTH_IN),
  textWidthIn: DEV_TEXT_WIDTH,
  fullWidthIn: DEV_TEXT_WIDTH + DEV_COLUMN_GAP + DEV_IMAGE_WIDTH,
  title: {
    top: pct(DEV_TITLE_Y, SLIDE_HEIGHT_IN),
    height: pct(DEV_TITLE_H, SLIDE_HEIGHT_IN),
    boxHeightIn: DEV_TITLE_H,
  },
  accentLine: {
    top: pct(DEV_LINE_Y, SLIDE_HEIGHT_IN),
    width: pct(0.5, SLIDE_WIDTH_IN),
    height: cqw(DEV_LINE_H, SLIDE_HEIGHT_IN),
  },
  contentRow: {
    top: pct(DEV_CONTENT_Y, SLIDE_HEIGHT_IN),
    height: pct(DEV_CONTENT_H, SLIDE_HEIGHT_IN),
    boxHeightIn: DEV_CONTENT_H,
  },
  imageCornerRadius: cqw(0.22, SLIDE_WIDTH_IN),
  bulletFontSizeRatio: 0.68,
};

export const TITLE_FONT_SIZE_TIERS = [34, 30, 26, 22];
export const BODY_FONT_SIZE_TIERS = [24, 21, 18, 16, 14];
