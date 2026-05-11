import { z } from "zod";

const slugRegex = /^[a-z0-9][a-z0-9-]*$/;
const sourceIdRegex = /^[a-z0-9][a-z0-9_-]*$/;

export const grammarPatternInputSchema = z
  .object({
    label: z.string().min(1).optional(),
    form: z.string().min(1),
    use: z.string().min(1).optional(),
    examples: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const grammarExampleInputSchema = z
  .object({
    text: z.string().min(1),
    translation: z.string().optional(),
    explanation: z.string().optional(),
    correct: z.boolean().optional(),
    note: z.string().optional(),
  })
  .strict();

export const grammarMistakeInputSchema = z
  .object({
    wrong: z.string().min(1),
    correct: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

export const grammarCheckInputSchema = z
  .object({
    prompt: z.string().min(1),
    answer: z.string().min(1),
    explanation: z.string().optional(),
  })
  .strict();

export const grammarTopicInputSchema = z
  .object({
    id: z.string().min(1).regex(sourceIdRegex, "id must match [a-z0-9][a-z0-9_-]*").optional(),
    slug: z.string().regex(slugRegex, "slug must be lowercase-kebab"),
    title: z.string().min(1),
    summary_md: z.string().optional(),
    explanation_md: z.string().optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.string().min(1)).optional(),
    patterns: z.array(grammarPatternInputSchema).optional(),
    examples: z.array(grammarExampleInputSchema).optional(),
    common_mistakes: z.array(grammarMistakeInputSchema).optional(),
    checks: z.array(grammarCheckInputSchema).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const grammarFileSchema = z
  .object({
    book: z.string().min(1),
    book_title: z.string().min(1).optional(),
    unit: z
      .object({
        ordinal: z.number().int().min(1),
        code: z.string().min(1),
        title: z.string().min(1),
        summary_md: z.string().optional(),
      })
      .strict(),
    lesson: z
      .object({
        ordinal: z.number().int().min(1),
        kind: z.literal("grammar"),
        title: z.string().min(1),
        slug: z.string().regex(slugRegex, "slug must be lowercase-kebab"),
      })
      .strict(),
    topics: z.array(grammarTopicInputSchema).min(1, "file must contain at least one topic"),
  })
  .strict();

export type GrammarFileInput = z.infer<typeof grammarFileSchema>;
export type GrammarTopicInput = z.infer<typeof grammarTopicInputSchema>;
