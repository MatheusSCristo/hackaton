import { Injectable } from "@nestjs/common";
import PptxGenJS from "pptxgenjs";

import type { Apresentacao, Slide } from "./schemas";

/**
 * Tema visual portado do "Slide Generator" (paleta P360, 16:9, tipografia em
 * tiers para auto-fit). Sem as imagens do original: os tópicos ocupam a largura
 * inteira, o que mantém o layout equilibrado sem depender de banco de imagens.
 */
const PALETA = {
  brandRed: "E4383E",
  brandTeal: "62C4CE",
  title: "1F2A37",
  body: "3A4A58",
  muted: "8492A0",
  white: "FFFFFF",
} as const;

const FONTE = "Calibri";
const LARGURA = 10;
const ALTURA = 5.625;
const MARGEM = 0.6;
const LARGURA_TEXTO = LARGURA - MARGEM * 2;

/** Tamanhos em ordem decrescente: cai um tier quando o texto é longo. */
const TIERS_TITULO = [34, 30, 26, 22];
const TIERS_CORPO = [24, 21, 18, 16, 14];

function tierTitulo(texto: string): number {
  if (texto.length <= 30) return TIERS_TITULO[0];
  if (texto.length <= 45) return TIERS_TITULO[1];
  if (texto.length <= 62) return TIERS_TITULO[2];
  return TIERS_TITULO[3];
}

/**
 * Escolhe o tamanho do corpo estimando quantas linhas os tópicos ocupam.
 * Portado de `text-fit.ts` do original (mesma heurística de largura média de
 * caractere), sem a dependência de medir texto de verdade.
 */
function tierCorpo(bullets: string[]): number {
  const alturaDisponivel = 3.1; // polegadas entre título e rodapé
  for (const tamanho of TIERS_CORPO) {
    const charsPorLinha = Math.floor((LARGURA_TEXTO * 96) / (tamanho * 0.5));
    const linhas = bullets.reduce(
      (total, bullet) =>
        total + Math.max(1, Math.ceil(bullet.length / charsPorLinha)),
      0,
    );
    const alturaLinha = (tamanho * 1.35) / 72;
    const espacoEntreItens = bullets.length * 0.12;
    if (linhas * alturaLinha + espacoEntreItens <= alturaDisponivel) {
      return tamanho;
    }
  }
  return TIERS_CORPO[TIERS_CORPO.length - 1];
}

@Injectable()
export class PptxRendererService {
  async render(apresentacao: Apresentacao): Promise<Buffer> {
    const deck = new PptxGenJS();
    deck.defineLayout({ name: "P360", width: LARGURA, height: ALTURA });
    deck.layout = "P360";
    deck.author = "Paciente 360";
    deck.title = apresentacao.title;

    apresentacao.slides.forEach((slide, index) => {
      if (slide.role === "development") {
        this.slideConteudo(deck, slide, index + 1, apresentacao.slides.length);
      } else {
        this.slideCapa(deck, slide, apresentacao);
      }
    });

    const saida = await deck.write({ outputType: "nodebuffer" });
    return saida as Buffer;
  }

  /** Capa e fechamento: bloco centralizado, sem tópicos. */
  private slideCapa(
    deck: PptxGenJS,
    slide: Slide,
    apresentacao: Apresentacao,
  ): void {
    const s = deck.addSlide();
    s.background = { color: PALETA.title };

    const titulo = slide.title || apresentacao.title;
    s.addText(titulo, {
      x: MARGEM,
      y: 1.9,
      w: LARGURA_TEXTO,
      h: 1.2,
      fontFace: FONTE,
      fontSize: tierTitulo(titulo),
      bold: true,
      color: PALETA.white,
      valign: "bottom",
    });

    // Linha vermelha da marca, entre título e subtítulo.
    s.addShape("rect", {
      x: MARGEM,
      y: 3.2,
      w: 1.2,
      h: 0.05,
      fill: { color: PALETA.brandRed },
      line: { color: PALETA.brandRed, width: 0 },
    });

    const subtitulo = slide.subtitle ?? apresentacao.subtitle;
    if (subtitulo) {
      s.addText(subtitulo, {
        x: MARGEM,
        y: 3.4,
        w: LARGURA_TEXTO,
        h: 0.8,
        fontFace: FONTE,
        fontSize: 16,
        color: PALETA.brandTeal,
        valign: "top",
      });
    }

    if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
  }

  /** Slide de desenvolvimento: título + tópicos em largura total. */
  private slideConteudo(
    deck: PptxGenJS,
    slide: Slide,
    numero: number,
    total: number,
  ): void {
    const s = deck.addSlide();
    s.background = { color: PALETA.white };

    s.addText(slide.title, {
      x: MARGEM,
      y: 0.45,
      w: LARGURA_TEXTO,
      h: 0.8,
      fontFace: FONTE,
      fontSize: tierTitulo(slide.title),
      bold: true,
      color: PALETA.title,
      valign: "middle",
    });

    s.addShape("rect", {
      x: MARGEM,
      y: 1.32,
      w: 1.0,
      h: 0.045,
      fill: { color: PALETA.brandRed },
      line: { color: PALETA.brandRed, width: 0 },
    });

    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: MARGEM,
        y: 1.42,
        w: LARGURA_TEXTO,
        h: 0.35,
        fontFace: FONTE,
        fontSize: 13,
        color: PALETA.muted,
      });
    }

    const yTopicos = slide.subtitle ? 1.85 : 1.6;
    s.addText(
      slide.content.map((bullet) => ({
        text: bullet,
        options: { bullet: { code: "2022" }, breakLine: true },
      })),
      {
        x: MARGEM,
        y: yTopicos,
        w: LARGURA_TEXTO,
        h: ALTURA - yTopicos - 0.6,
        fontFace: FONTE,
        fontSize: tierCorpo(slide.content),
        color: PALETA.body,
        lineSpacingMultiple: 1.3,
        valign: "top",
      },
    );

    s.addText(`${numero} / ${total}`, {
      x: LARGURA - MARGEM - 1.0,
      y: ALTURA - 0.5,
      w: 1.0,
      h: 0.3,
      fontFace: FONTE,
      fontSize: 10,
      color: PALETA.muted,
      align: "right",
    });

    if (slide.speakerNotes) s.addNotes(slide.speakerNotes);
  }
}
