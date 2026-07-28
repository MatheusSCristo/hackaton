import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import JSZip from "jszip";

/** Além disso o texto não cabe no prompt sem competir com o resto do contexto. */
const MAX_CARACTERES = 20_000;

/** `ppt/slides/slide12.xml` → 12. Ordena os slides como no arquivo. */
const NOME_DE_SLIDE = /^ppt\/slides\/slide(\d+)\.xml$/;

export interface TextoDoPptx {
  /** Um item por slide, na ordem da apresentação original. */
  slides: string[];
  /** Tudo junto, já cortado no limite do prompt. */
  texto: string;
}

/**
 * Extrai o texto de um `.pptx` enviado pelo professor.
 *
 * Um `.pptx` é um ZIP de XMLs; o texto visível de cada slide vive em runs
 * `<a:t>`. Só isso interessa aqui — não tentamos reproduzir layout, imagens ou
 * animações: o arquivo entra como **conteúdo de base** para a geração, não como
 * template de renderização.
 */
@Injectable()
export class PptxTextoService {
  private readonly logger = new Logger(PptxTextoService.name);

  async extrair(buffer: Buffer): Promise<TextoDoPptx> {
    const zip = await this.abrir(buffer);

    const arquivos = Object.keys(zip.files)
      .map((nome) => ({ nome, ordem: NOME_DE_SLIDE.exec(nome)?.[1] }))
      .filter((f) => f.ordem !== undefined)
      .sort((a, b) => Number(a.ordem) - Number(b.ordem));

    if (arquivos.length === 0) {
      throw new BadRequestException(
        "O arquivo não parece ser uma apresentação do PowerPoint (.pptx).",
      );
    }

    const slides: string[] = [];
    for (const { nome } of arquivos) {
      const xml = await zip.files[nome].async("string");
      const conteudo = textoDoSlide(xml);
      if (conteudo) slides.push(conteudo);
    }

    if (slides.length === 0) {
      throw new BadRequestException(
        "Não encontramos texto nos slides deste arquivo.",
      );
    }

    const completo = slides
      .map((s, i) => `--- Slide ${i + 1} ---\n${s}`)
      .join("\n\n");

    return { slides, texto: completo.slice(0, MAX_CARACTERES) };
  }

  private async abrir(buffer: Buffer): Promise<JSZip> {
    try {
      return await JSZip.loadAsync(buffer);
    } catch (error) {
      // Arquivo corrompido/protegido por senha é erro do usuário, não nosso.
      this.logger.warn(`Falha ao abrir o .pptx enviado: ${String(error)}`);
      throw new BadRequestException(
        "Não foi possível ler o arquivo. Envie um .pptx válido e sem senha.",
      );
    }
  }
}

/**
 * Junta os runs de texto do slide.
 *
 * Cada `<a:p>` é um parágrafo e vira uma linha; os `<a:t>` dentro dele são
 * pedaços do mesmo parágrafo (o PowerPoint quebra um texto em vários runs a
 * cada mudança de formatação) e por isso são concatenados sem separador.
 */
function textoDoSlide(xml: string): string {
  const paragrafos = xml.split(/<a:p[ >]/).slice(1);

  const linhas = paragrafos
    .map((paragrafo) =>
      [...paragrafo.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((m) => desescapar(m[1]))
        .join("")
        .trim(),
    )
    .filter((linha) => linha.length > 0);

  return linhas.join("\n");
}

function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&amp;/g, "&");
}
