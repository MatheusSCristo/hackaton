import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Apresentacao } from "./schemas";

export interface ResolvedImage {
  finalUrl: string;
  dataUri: string;
  mimeType: string;
}

const ALLOWED_IMAGE_HOSTS = [
  "images.unsplash.com",
  "unsplash.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "nih.gov",
  "cdc.gov",
  "picsum.photos",
];

const RASTER_IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp)$/i;
const WIKIMEDIA_SEARCH_RESULTS = 8;
const WIKIMEDIA_MAX_RETRIES = 2;
const WIKIMEDIA_RETRY_DELAY_MS = 600;
const IMAGE_SEARCH_STAGGER_MS = 350;
const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 6_000_000;

interface WikimediaSearchResponse {
  query?: {
    pages?: Record<string, { imageinfo?: Array<{ url?: string }> }>;
  };
}

interface UnsplashSearchResponse {
  results?: Array<{ urls?: { regular?: string } }>;
}

/**
 * Resolve imagens reais para os slides de desenvolvimento — cadeia:
 * URL sugerida pela IA (se em host permitido) → Unsplash → Wikimedia Commons
 * → Picsum (fallback determinístico, nunca falha). Portado do
 * `projeto-hackathon` (`image-resolver.service.ts`).
 */
@Injectable()
export class ImageResolverService {
  private readonly logger = new Logger(ImageResolverService.name);
  private readonly unsplashAccessKey: string;

  constructor(config: ConfigService) {
    this.unsplashAccessKey = config.get<string>("UNSPLASH_ACCESS_KEY") ?? "";
  }

  /** Resolve e injeta `slide.visual.imageUrl` (data URI) em cada slide de desenvolvimento, in-place. */
  async resolveForPresentation(apresentacao: Apresentacao): Promise<void> {
    const developmentIndices = apresentacao.slides
      .map((slide, index) => (slide.role === "development" ? index : -1))
      .filter((index) => index !== -1);

    await Promise.all(
      apresentacao.slides.map(async (slide, index) => {
        if (slide.role !== "development") return;

        const staggerPosition = developmentIndices.indexOf(index);
        await this.sleep(staggerPosition * IMAGE_SEARCH_STAGGER_MS);

        const keyword = slide.visual?.keyword ?? slide.title;
        try {
          const resolved = await this.resolve(slide.visual?.imageUrl, keyword, apresentacao.title);
          slide.visual = { keyword, imageUrl: resolved.dataUri };
        } catch (error) {
          this.logWarn(`Falha ao resolver imagem para "${keyword}" — slide fica sem imagem`, error);
          slide.visual = undefined;
        }
      }),
    );
  }

  private async resolve(candidateUrl: string | undefined, keyword: string, presentationTopic: string): Promise<ResolvedImage> {
    if (candidateUrl && this.isAllowedUrl(candidateUrl)) {
      try {
        return await this.fetchImage(candidateUrl);
      } catch (error) {
        this.logWarn(`Suggested image URL (${candidateUrl}) failed`, error);
      }
    } else if (candidateUrl) {
      this.logger.warn(`Rejected image URL from a non-allowlisted host: ${candidateUrl}`);
    }

    if (this.unsplashAccessKey) {
      try {
        const unsplashUrl = await this.searchUnsplash(keyword);
        if (unsplashUrl) return await this.fetchImage(unsplashUrl);
      } catch (error) {
        this.logWarn(`Unsplash search failed for "${keyword}"`, error);
      }
    }

    try {
      const wikimediaUrl = await this.searchWikimediaCommons(keyword);
      if (wikimediaUrl) return await this.fetchImage(wikimediaUrl);
    } catch (error) {
      this.logWarn(`Wikimedia Commons search failed for "${keyword}"`, error);
    }

    const broaderQuery = `${presentationTopic} ${keyword}`;
    try {
      if (this.unsplashAccessKey) {
        const unsplashUrl = await this.searchUnsplash(broaderQuery);
        if (unsplashUrl) return await this.fetchImage(unsplashUrl);
      }

      const wikimediaUrl = await this.searchWikimediaCommons(broaderQuery);
      if (wikimediaUrl) return await this.fetchImage(wikimediaUrl);
    } catch (error) {
      this.logWarn(`Broader image search failed for "${broaderQuery}"`, error);
    }

    this.logger.warn(`No relevant image found for "${keyword}". Falling back to a generic placeholder photo.`);
    return this.fetchImage(this.buildFallbackUrl(keyword));
  }

  private async searchUnsplash(query: string): Promise<string | null> {
    const searchUrl = new URL("https://api.unsplash.com/search/photos");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("per_page", "1");
    searchUrl.searchParams.set("content_filter", "high");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { Authorization: `Client-ID ${this.unsplashAccessKey}` },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as UnsplashSearchResponse;
      return data.results?.[0]?.urls?.regular ?? null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async searchWikimediaCommons(query: string, attempt = 1): Promise<string | null> {
    const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("generator", "search");
    searchUrl.searchParams.set("gsrsearch", `filetype:bitmap ${query}`);
    searchUrl.searchParams.set("gsrnamespace", "6");
    searchUrl.searchParams.set("gsrlimit", String(WIKIMEDIA_SEARCH_RESULTS));
    searchUrl.searchParams.set("prop", "imageinfo");
    searchUrl.searchParams.set("iiprop", "url");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("origin", "*");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(searchUrl, { signal: controller.signal });

      if (response.status === 429 && attempt <= WIKIMEDIA_MAX_RETRIES) {
        clearTimeout(timeout);
        await this.sleep(WIKIMEDIA_RETRY_DELAY_MS * attempt);
        return this.searchWikimediaCommons(query, attempt + 1);
      }

      if (!response.ok) return null;

      const data = (await response.json()) as WikimediaSearchResponse;
      const pages = Object.values(data.query?.pages ?? {});

      for (const page of pages) {
        const url = page.imageinfo?.[0]?.url;
        if (url && RASTER_IMAGE_EXTENSION_PATTERN.test(url)) return url;
      }

      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isAllowedUrl(rawUrl: string): boolean {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:") return false;
      return ALLOWED_IMAGE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }

  private buildFallbackUrl(keyword: string): string {
    const seed =
      keyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "presentation";

    return `https://picsum.photos/seed/${seed}/900/700`;
  }

  private logWarn(message: string, error: unknown): void {
    const reason = error instanceof Error ? error.message : "unknown error";
    this.logger.warn(`${message}: ${reason}`);
  }

  private async fetchImage(url: string | URL): Promise<ResolvedImage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal, redirect: "follow" });

      if (!response.ok) throw new Error(`unexpected status ${response.status}`);

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`unexpected content-type "${contentType}"`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
        throw new Error("image exceeds the maximum allowed size");
      }

      const mimeType = contentType.split(";")[0].trim();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return {
        finalUrl: response.url || url.toString(),
        dataUri: `data:${mimeType};base64,${base64}`,
        mimeType,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
