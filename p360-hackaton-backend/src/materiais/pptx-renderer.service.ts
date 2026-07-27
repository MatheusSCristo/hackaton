import { Injectable, Logger } from "@nestjs/common";
import * as path from "path";
import PptxGenJS from "pptxgenjs";

import { roundImageCorners } from "./pptx-image-processor";
import type { Apresentacao, Slide } from "./schemas";

/** Imagem de fundo da capa/fechamento — portada do "Slide Generator". */
const HERO_BACKGROUND_IMAGE_PATH = path.join(__dirname, "assets", "start-end-bg.png");

/**
 * Tema visual portado do "Slide Generator" (paleta P360, 16:9, tipografia em
 * tiers para auto-fit). Slides de desenvolvimento com `visual.imageUrl`
 * (resolvido pelo `ImageResolverService`) ganham uma imagem arredondada à
 * direita; sem imagem, os tópicos ocupam a largura inteira.
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

/** Coluna de imagem: 38% da largura útil, à direita. */
const LARGURA_IMAGEM = LARGURA_TEXTO * 0.38;
const LARGURA_TEXTO_COM_IMAGEM = LARGURA_TEXTO - LARGURA_IMAGEM - 0.35;
const RAIO_IMAGEM = 0.12;

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
function tierCorpo(bullets: string[], larguraDisponivel: number): number {
  const alturaDisponivel = 3.1; // polegadas entre título e rodapé
  for (const tamanho of TIERS_CORPO) {
    const charsPorLinha = Math.floor((larguraDisponivel * 96) / (tamanho * 0.5));
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
  private readonly logger = new Logger(PptxRendererService.name);

  async render(apresentacao: Apresentacao): Promise<Buffer> {
    const deck = new PptxGenJS();
    deck.defineLayout({ name: "P360", width: LARGURA, height: ALTURA });
    deck.layout = "P360";
    deck.author = "Paciente 360";
    deck.title = apresentacao.title;

    // Sequencial (não Promise.all): a ordem de `deck.addSlide()` define a
    // ordem final do PPTX.
    for (let index = 0; index < apresentacao.slides.length; index++) {
      const slide = apresentacao.slides[index];
      if (slide.role === "development") {
        await this.slideConteudo(deck, slide, index + 1, apresentacao.slides.length);
      } else {
        this.slideCapa(deck, slide, apresentacao);
      }
    }

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
    s.background = { path: HERO_BACKGROUND_IMAGE_PATH };

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

  /** Slide de desenvolvimento: título + tópicos, com imagem arredondada à direita quando houver. */
  private async slideConteudo(
    deck: PptxGenJS,
    slide: Slide,
    numero: number,
    total: number,
  ): Promise<void> {
    const s = deck.addSlide();
    s.background = { color: PALETA.white };

    const imagem = await this.prepararImagem(slide);
    const larguraTexto = imagem ? LARGURA_TEXTO_COM_IMAGEM : LARGURA_TEXTO;

    s.addText(slide.title, {
      x: MARGEM,
      y: 0.45,
      w: larguraTexto,
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
        w: larguraTexto,
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
        w: larguraTexto,
        h: ALTURA - yTopicos - 0.6,
        fontFace: FONTE,
        fontSize: tierCorpo(slide.content, larguraTexto),
        color: PALETA.body,
        lineSpacingMultiple: 1.3,
        valign: "top",
      },
    );

    if (imagem) {
      const yImagem = 1.6;
      const alturaImagem = ALTURA - yImagem - 0.6;
      s.addImage({
        data: imagem,
        x: LARGURA - MARGEM - LARGURA_IMAGEM,
        y: yImagem,
        w: LARGURA_IMAGEM,
        h: alturaImagem,
      });
    }

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

  /** Arredonda a imagem já resolvida (data URI) para o box da coluna direita. */
  private async prepararImagem(slide: Slide): Promise<string | null> {
    const dataUri = slide.visual?.imageUrl;
    if (!dataUri || !dataUri.startsWith("data:")) return null;

    try {
      const alturaImagem = ALTURA - 1.6 - 0.6;
      return await roundImageCorners(dataUri, LARGURA_IMAGEM, alturaImagem, RAIO_IMAGEM);
    } catch (error) {
      this.logger.warn(`Falha ao processar imagem do slide "${slide.title}": ${String(error)}`);
      return null;
    }
  }
}
