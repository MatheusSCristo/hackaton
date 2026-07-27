import { z } from "zod";

/**
 * Schemas de validação da saída da IA — portados do projeto "Slide Generator".
 *
 * Os limites de tamanho não são decorativos: eles é que garantem que o texto
 * caiba no layout do PPTX/PDF sem estourar a caixa.
 */

// ---------------------------------------------------------------- slides

export const MIN_SLIDES = 3;
export const MAX_SLIDES = 12;
export const MAX_BULLETS_PER_SLIDE = 5;
const MAX_TITLE_LENGTH = 80;
const MAX_BULLET_LENGTH = 170;
const MAX_SUBTITLE_LENGTH = 120;
const MAX_SPEAKER_NOTES_LENGTH = 1500;
const MAX_IMAGE_KEYWORD_LENGTH = 60;

export const slideRoleSchema = z.enum([
  "introduction",
  "development",
  "conclusion",
]);

/** Sugestão de imagem do slide — a IA só descreve o assunto; a URL final vem do `ImageResolverService`. */
export const slideVisualSchema = z.object({
  keyword: z.string().min(1).max(MAX_IMAGE_KEYWORD_LENGTH),
  // Antes de resolvida, é uma URL curta sugerida pela IA; depois que o
  // `ImageResolverService` roda, vira uma data URI base64 embutida (bem
  // maior) — o limite aqui só existe pra rejeitar valores absurdos, não pra
  // restringir o tamanho real de uma imagem.
  imageUrl: z.string().max(10_000_000).optional(),
});

export const slideSchema = z
  .object({
    role: slideRoleSchema,
    title: z.string().min(1).max(MAX_TITLE_LENGTH),
    subtitle: z.string().max(MAX_SUBTITLE_LENGTH).optional(),
    content: z
      .array(z.string().min(1).max(MAX_BULLET_LENGTH))
      .max(MAX_BULLETS_PER_SLIDE)
      .default([]),
    speakerNotes: z.string().max(MAX_SPEAKER_NOTES_LENGTH).optional(),
    visual: slideVisualSchema.optional(),
  })
  .superRefine((slide, ctx) => {
    // Slide de desenvolvimento sem bullet não ensina nada; hero com bullets
    // quebra o layout (é uma capa).
    if (slide.role === "development" && slide.content.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Slide de desenvolvimento precisa de ao menos um tópico.",
      });
    }
  });

export const apresentacaoSchema = z
  .object({
    title: z.string().min(1).max(MAX_TITLE_LENGTH),
    subtitle: z.string().max(MAX_SUBTITLE_LENGTH).optional(),
    slides: z.array(slideSchema).min(MIN_SLIDES).max(MAX_SLIDES),
  })
  .superRefine((apresentacao, ctx) => {
    const { slides } = apresentacao;
    if (slides[0]?.role !== "introduction") {
      ctx.addIssue({
        code: "custom",
        message: "O primeiro slide deve ser a introdução.",
      });
    }
    if (slides[slides.length - 1]?.role !== "conclusion") {
      ctx.addIssue({
        code: "custom",
        message: "O último slide deve ser a conclusão.",
      });
    }
  });

export type Apresentacao = z.infer<typeof apresentacaoSchema>;
export type Slide = z.infer<typeof slideSchema>;

// -------------------------------------------------------------- simulado

export const MIN_QUESTOES = 3;
export const MAX_QUESTOES = 10;
export const ALTERNATIVAS_POR_QUESTAO = 4;
export const LABELS_ALTERNATIVA = ["A", "B", "C", "D"] as const;

export const alternativaSchema = z.object({
  label: z.enum(LABELS_ALTERNATIVA),
  text: z.string().min(1).max(300),
  isCorrect: z.boolean().default(false),
  explanationIfIncorrect: z.string().max(800).optional(),
});

export const questaoSchema = z
  .object({
    statement: z.string().min(1).max(1500),
    alternatives: z.array(alternativaSchema).length(ALTERNATIVAS_POR_QUESTAO),
    explanationCorrect: z.string().min(1).max(800),
    competency: z.string().max(200).optional(),
    difficulty: z.string().max(50).optional(),
    technicalReference: z.string().max(300).optional(),
  })
  .superRefine((questao, ctx) => {
    const corretas = questao.alternatives.filter((a) => a.isCorrect);
    if (corretas.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "A questão precisa de exatamente uma alternativa correta.",
      });
    }
    const labels = new Set(questao.alternatives.map((a) => a.label));
    if (labels.size !== questao.alternatives.length) {
      ctx.addIssue({ code: "custom", message: "Labels A–D duplicados." });
    }
  });

export const simuladoSchema = z.object({
  title: z.string().min(1).max(150),
  questions: z.array(questaoSchema).min(MIN_QUESTOES).max(MAX_QUESTOES),
});

export type Simulado = z.infer<typeof simuladoSchema>;
export type Questao = z.infer<typeof questaoSchema>;

// ---------------------------------------------------------------- resumo

export const secaoResumoSchema = z.object({
  heading: z.string().min(1).max(100),
  paragraphs: z.array(z.string().min(1).max(700)).min(1).max(4),
  callout: z.string().max(300).optional(),
});

export const resumoSchema = z.object({
  title: z.string().min(1).max(100),
  introduction: z.string().min(1).max(700),
  sections: z.array(secaoResumoSchema).min(1).max(10),
  closing: z.string().max(500).optional(),
});

export type Resumo = z.infer<typeof resumoSchema>;

// ------------------------------------------------- material complementar

export const MIN_REFERENCIAS = 3;
export const MAX_REFERENCIAS = 8;

export const tipoReferenciaSchema = z.enum(["artigo", "video", "livro", "site"]);

export const referenciaSchema = z.object({
  title: z.string().min(1).max(140),
  type: tipoReferenciaSchema,
  description: z.string().min(1).max(300),
  url: z.string().max(500).optional(),
});

export const materialComplementarSchema = z.object({
  title: z.string().min(1).max(100),
  introduction: z.string().min(1).max(500),
  references: z.array(referenciaSchema).min(MIN_REFERENCIAS).max(MAX_REFERENCIAS),
});

export type MaterialComplementar = z.infer<typeof materialComplementarSchema>;
export type Referencia = z.infer<typeof referenciaSchema>;
export type TipoReferencia = z.infer<typeof tipoReferenciaSchema>;
