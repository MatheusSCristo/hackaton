import sharp from "sharp";

const RENDER_DPI = 150;

function inchesToPixels(valueIn: number): number {
  return Math.round(valueIn * RENDER_DPI);
}

function extractBase64Payload(dataUri: string): string {
  const commaIndex = dataUri.indexOf(",");
  return commaIndex === -1 ? dataUri : dataUri.slice(commaIndex + 1);
}

/** Recorta/redimensiona a imagem e arredonda os cantos — portado do "Slide Generator". */
export async function roundImageCorners(
  dataUri: string,
  widthIn: number,
  heightIn: number,
  radiusIn: number,
): Promise<string> {
  const widthPx = inchesToPixels(widthIn);
  const heightPx = inchesToPixels(heightIn);
  const radiusPx = inchesToPixels(radiusIn);

  const inputBuffer = Buffer.from(extractBase64Payload(dataUri), "base64");

  const resized = await sharp(inputBuffer)
    .resize(widthPx, heightPx, { fit: "cover", position: "centre" })
    .toBuffer();

  const maskSvg = `<svg width="${widthPx}" height="${heightPx}"><rect x="0" y="0" width="${widthPx}" height="${heightPx}" rx="${radiusPx}" ry="${radiusPx}" fill="#fff"/></svg>`;
  const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  const rounded = await sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  return `data:image/png;base64,${rounded.toString("base64")}`;
}
