/** Portado do `projeto-hackathon` (`shared/presentation/text-fit.ts`) sem alterações. */
export interface BoxSize {
  widthIn: number;
  heightIn: number;
}

const SLIDE_WIDTH_IN = 10;
const AVG_CHAR_WIDTH_FACTOR = 0.52;
const LINE_HEIGHT_FACTOR = 1.3;
const BULLET_GAP_LINES = 0.4;

function estimateWrappedLines(text: string, fontSizePt: number, widthIn: number): number {
  const charsPerLine = Math.max(1, Math.floor((widthIn * 72) / (fontSizePt * AVG_CHAR_WIDTH_FACTOR)));
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function pointsToContainerWidthUnits(fontSizePt: number): string {
  return `${(fontSizePt / 72 / SLIDE_WIDTH_IN) * 100}cqw`;
}

export function fitBulletsToBox(bullets: string[], box: BoxSize, fontSizeTiers: number[]): string {
  const sortedTiers = [...fontSizeTiers].sort((a, b) => b - a);

  for (const fontSize of sortedTiers) {
    const lineHeightIn = (fontSize / 72) * LINE_HEIGHT_FACTOR;
    const totalLines = bullets.reduce(
      (sum, bullet) => sum + estimateWrappedLines(bullet, fontSize, box.widthIn) + BULLET_GAP_LINES,
      0,
    );

    if (totalLines * lineHeightIn <= box.heightIn) {
      return pointsToContainerWidthUnits(fontSize);
    }
  }

  return pointsToContainerWidthUnits(sortedTiers[sortedTiers.length - 1]);
}
