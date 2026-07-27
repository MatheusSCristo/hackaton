import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";

import type { MaterialComplementar, Referencia, TipoReferencia } from "./schemas";
import type { Resumo } from "./schemas";

const LABEL_TIPO_REFERENCIA: Record<TipoReferencia, string> = {
  artigo: "ARTIGO CIENTÍFICO",
  video: "VÍDEO",
  livro: "LIVRO",
  site: "SITE / GUIDELINE",
};

/** Tema portado do `pdf-template.ts` do projeto de origem. */
const PALETA = {
  brandRed: "#E4383E",
  brandTeal: "#62C4CE",
  title: "#1F2A37",
  body: "#3A4A58",
  muted: "#8492A0",
  calloutBg: "#F1F8F9",
} as const;

const MARGEM = 56;
const RESERVA_RODAPE = 24;

/**
 * PDFKit usa as fontes padrão do PDF (WinAnsi), que não têm alguns caracteres
 * comuns em texto gerado. Sanitizar evita "□" no documento final — o original
 * tinha o mesmo cuidado (`pdf-text-sanitizer.ts`).
 */
const SUBSTITUICOES: [RegExp, string][] = [
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/—/g, "-"],
  [/–/g, "-"],
  [/→/g, "->"],
  [/≥/g, ">="],
  [/≤/g, "<="],
];

/** Construída a partir de string para não deixar o caractere literal no fonte. */
const NBSP = new RegExp("\\u00a0", "g");

function sanitizar(texto: string): string {
  const base = SUBSTITUICOES.reduce(
    (acc, [regex, sub]) => acc.replace(regex, sub),
    texto,
  ).replace(NBSP, " ");

  // Subscritos (H₂O → H2O) exigem replacer, então ficam fora da tabela.
  return base.replace(/[₀-₉]/g, (m) => String(m.charCodeAt(0) - 0x2080));
}

@Injectable()
export class PdfRendererService {
  async renderResumo(resumo: Resumo): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: MARGEM,
        bottom: MARGEM + RESERVA_RODAPE,
        left: MARGEM,
        right: MARGEM,
      },
      bufferPages: true,
      info: { Title: resumo.title, Author: "Paciente 360" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finalizado = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    this.cabecalho(doc, resumo.title);
    this.paragrafo(doc, resumo.introduction, { tamanho: 11, cor: PALETA.body });
    doc.moveDown(0.8);

    resumo.sections.forEach((secao, index) => {
      if (index > 0) doc.moveDown(0.6);
      this.tituloSecao(doc, secao.heading);
      secao.paragraphs.forEach((paragrafo) => {
        this.paragrafo(doc, paragrafo, { tamanho: 10.5, cor: PALETA.body });
      });
      if (secao.callout) this.callout(doc, secao.callout);
    });

    if (resumo.closing) {
      doc.moveDown(0.8);
      this.tituloSecao(doc, "Para levar daqui");
      this.paragrafo(doc, resumo.closing, {
        tamanho: 10.5,
        cor: PALETA.body,
      });
    }

    this.rodapes(doc);
    doc.end();
    return finalizado;
  }

  /** PDF do material complementar: introdução + lista de referências com link clicável. */
  async renderMaterialComplementar(material: MaterialComplementar): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: MARGEM,
        bottom: MARGEM + RESERVA_RODAPE,
        left: MARGEM,
        right: MARGEM,
      },
      bufferPages: true,
      info: { Title: material.title, Author: "Paciente 360" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finalizado = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    this.cabecalho(doc, material.title);
    this.paragrafo(doc, material.introduction, { tamanho: 11, cor: PALETA.body });
    doc.moveDown(0.4);

    material.references.forEach((referencia) => this.referencia(doc, referencia));

    this.rodapes(doc);
    doc.end();
    return finalizado;
  }

  private cabecalho(doc: PDFKit.PDFDocument, titulo: string): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor(PALETA.title)
      .text(sanitizar(titulo), { align: "left" });

    const y = doc.y + 6;
    doc
      .moveTo(MARGEM, y)
      .lineTo(MARGEM + 60, y)
      .lineWidth(3)
      .strokeColor(PALETA.brandRed)
      .stroke();

    doc.moveDown(1.1);
  }

  private tituloSecao(doc: PDFKit.PDFDocument, texto: string): void {
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor(PALETA.title)
      .text(sanitizar(texto));
    doc.moveDown(0.35);
  }

  private paragrafo(
    doc: PDFKit.PDFDocument,
    texto: string,
    opts: { tamanho: number; cor: string },
  ): void {
    doc
      .font("Helvetica")
      .fontSize(opts.tamanho)
      .fillColor(opts.cor)
      .text(sanitizar(texto), { align: "justify", lineGap: 2.5 });
    doc.moveDown(0.5);
  }

  /** Caixa de destaque com barra teal à esquerda. */
  private callout(doc: PDFKit.PDFDocument, texto: string): void {
    const limpo = sanitizar(texto);
    const largura = doc.page.width - MARGEM * 2;
    const larguraTexto = largura - 22;

    doc.font("Helvetica-Oblique").fontSize(10);
    const altura = doc.heightOfString(limpo, { width: larguraTexto }) + 16;

    // Quebra de página antes de desenhar, para o retângulo não cortar.
    if (doc.y + altura > doc.page.height - MARGEM - RESERVA_RODAPE) {
      doc.addPage();
    }

    const y = doc.y;
    doc.rect(MARGEM, y, largura, altura).fillColor(PALETA.calloutBg).fill();
    doc.rect(MARGEM, y, 3, altura).fillColor(PALETA.brandTeal).fill();

    doc
      .fillColor(PALETA.body)
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text(limpo, MARGEM + 14, y + 8, { width: larguraTexto });

    // `.text(str, x, y)` com x explícito muda o cursor `doc.x` do PDFKit
    // permanentemente — sem resetar, todo texto seguinte (títulos,
    // parágrafos) herdava esse recuo de +14 em vez de voltar pra margem.
    doc.x = MARGEM;
    doc.y = y + altura;
    doc.moveDown(0.6);
  }

  /** Uma referência: selo do tipo, título como link, URL truncada, descrição. */
  private referencia(doc: PDFKit.PDFDocument, ref: Referencia): void {
    const largura = doc.page.width - MARGEM * 2;

    if (doc.y + 90 > doc.page.height - MARGEM - RESERVA_RODAPE) {
      doc.addPage();
    }
    doc.moveDown(0.5);

    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(PALETA.muted)
      .text(LABEL_TIPO_REFERENCIA[ref.type] ?? ref.type.toUpperCase(), { characterSpacing: 1 });
    doc.moveDown(0.15);

    const tituloTexto = sanitizar(ref.title);
    const tituloY = doc.y;
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(PALETA.brandRed)
      .text(tituloTexto, { underline: Boolean(ref.url) });
    if (ref.url) {
      doc.link(MARGEM, tituloY, doc.widthOfString(tituloTexto), doc.currentLineHeight(), ref.url);
    }
    doc.moveDown(0.1);

    if (ref.url) {
      const urlY = doc.y;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(PALETA.muted)
        .text(ref.url, { width: largura, lineBreak: false, ellipsis: true });
      doc.link(MARGEM, urlY, Math.min(doc.widthOfString(ref.url), largura), doc.currentLineHeight(), ref.url);
      doc.moveDown(0.25);
    }

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(PALETA.body)
      .text(sanitizar(ref.description), { lineGap: 2 });
  }

  private rodapes(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    const margemInferiorOriginal = doc.page.margins.bottom;

    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);

      // O rodapé fica na "zona reservada" (RESERVA_RODAPE) abaixo da margem
      // inferior efetiva — sem zerar a margem antes, o PDFKit acha que o
      // texto estourou a página e cria uma página extra em branco pra ele.
      doc.page.margins.bottom = 0;
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(PALETA.muted)
        .text(
          `${i + 1} / ${range.count}`,
          MARGEM,
          doc.page.height - MARGEM - 6,
          { width: doc.page.width - MARGEM * 2, align: "right", lineBreak: false },
        );
      doc.page.margins.bottom = margemInferiorOriginal;
    }
  }
}
