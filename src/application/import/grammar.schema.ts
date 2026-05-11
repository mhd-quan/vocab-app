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

const grammarActivityBaseSchema = z.object({
  id: z.string().min(1).regex(sourceIdRegex, "id must match [a-z0-9][a-z0-9_-]*").optional(),
  prompt: z.string().min(1).optional(),
  instruction: z.string().min(1).optional(),
  hint: z.string().min(1).optional(),
  explanation: z.string().min(1).optional(),
  points: z.number().int().min(1).max(10).optional(),
});

const acceptedAnswersSchema = z.array(z.string().min(1)).min(1).optional();

export const grammarChoiceOptionInputSchema = z
  .object({
    text: z.string().min(1),
    correct: z.boolean().optional(),
    explanation: z.string().min(1).optional(),
  })
  .strict();

export const grammarFillBlankActivityInputSchema = grammarActivityBaseSchema
  .extend({
    kind: z.literal("fill_blank"),
    sentence: z.string().min(1),
    answer: z.string().min(1).optional(),
    accepted_answers: acceptedAnswersSchema,
  })
  .strict()
  .refine((value) => value.answer || /\{\{[^{}]+\}\}/.test(value.sentence), {
    message: "fill_blank requires answer or one {{marked}} answer in sentence",
    path: ["answer"],
  });

export const grammarChoiceActivityInputSchema = grammarActivityBaseSchema
  .extend({
    kind: z.literal("choice"),
    question: z.string().min(1),
    options: z.array(grammarChoiceOptionInputSchema).min(2),
    answer: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (value) => value.options.some((option) => option.correct === true) || Boolean(value.answer),
    {
      message: "choice requires one correct option or answer",
      path: ["options"],
    },
  );

export const grammarOrderActivityInputSchema = grammarActivityBaseSchema
  .extend({
    kind: z.literal("order"),
    tokens: z.array(z.string().min(1)).min(2),
    answer: z.string().min(1),
    accepted_answers: acceptedAnswersSchema,
  })
  .strict();

export const grammarRewriteActivityInputSchema = grammarActivityBaseSchema
  .extend({
    kind: z.literal("rewrite"),
    prompt: z.string().min(1),
    instruction: z.string().min(1),
    answer: z.string().min(1),
    accepted_answers: acceptedAnswersSchema,
  })
  .strict();

export const grammarPromptedSentenceActivityInputSchema = grammarActivityBaseSchema
  .extend({
    kind: z.literal("prompted_sentence"),
    instruction: z.string().min(1),
    words: z.array(z.string().min(1)).min(1),
    answer: z.string().min(1),
    accepted_answers: acceptedAnswersSchema,
  })
  .strict();

export const grammarErrorCorrectionActivityInputSchema = grammarActivityBaseSchema
  .extend({
    kind: z.literal("error_correction"),
    sentence: z.string().min(1),
    answer: z.string().min(1),
    accepted_answers: acceptedAnswersSchema,
  })
  .strict();

export const grammarActivityInputSchema = z.union([
  grammarFillBlankActivityInputSchema,
  grammarChoiceActivityInputSchema,
  grammarOrderActivityInputSchema,
  grammarRewriteActivityInputSchema,
  grammarPromptedSentenceActivityInputSchema,
  grammarErrorCorrectionActivityInputSchema,
]);

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
    activities: z.array(grammarActivityInputSchema).optional(),
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
export type GrammarActivityInput = z.infer<typeof grammarActivityInputSchema>;
export type GrammarChoiceOptionInput = z.infer<typeof grammarChoiceOptionInputSchema>;
