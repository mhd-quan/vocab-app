import { z } from "zod";
import {
  cefrLevels,
  collocationPatterns,
  partsOfSpeech,
  vocabFormKinds,
  vocabRegisters,
  vocabRelationKinds,
} from "../../data/schema";

const slugRegex = /^[a-z0-9][a-z0-9-]*$/;
// Source ids may include underscores so they can encode multi-word POS
// (`phrasal_verb`, `past_participle`) directly. Slugs (lesson.slug) stay strict.
const sourceIdRegex = /^[a-z0-9][a-z0-9_-]*$/;

/** Input shape for one example, after Zod has accepted it. */
export const exampleInputSchema = z
  .object({
    text: z.string().min(1, "example text is required"),
    translation: z.string().optional(),
    cloze_target: z.string().optional(),
    cloze_hint: z.string().optional(),
    audio_ref: z.string().optional(),
    source_ref: z.string().optional(),
  })
  .strict();

export const senseInputSchema = z
  .object({
    definition_en: z.string().optional(),
    definition_vi: z.string().optional(),
    register: z.enum(vocabRegisters).optional(),
    domain: z.string().optional(),
    notes_md: z.string().optional(),
  })
  .strict()
  .refine((s) => s.definition_en || s.definition_vi, {
    message: "sense must have at least one of definition_en or definition_vi",
  });

export const formInputSchema = z
  .object({
    kind: z.enum(vocabFormKinds),
    text: z.string().min(1),
    ipa: z.string().optional(),
  })
  .strict();

export const collocationInputSchema = z
  .object({
    collocation: z.string().min(1),
    pattern: z.enum(collocationPatterns).optional(),
    example: z.string().optional(),
    notes_md: z.string().optional(),
  })
  .strict();

export const relationInputSchema = z
  .object({
    relation: z.enum(vocabRelationKinds),
    text: z.string().min(1).optional(),
  })
  .strict()
  .refine((r) => r.text, { message: "relation must include `text`" });

export const entryInputSchema = z
  .object({
    id: z.string().min(1).regex(sourceIdRegex, "id must match [a-z0-9][a-z0-9_-]*").optional(),
    headword: z.string().min(1),
    lemma: z.string().optional(),
    pos: z.enum(partsOfSpeech),
    ipa: z.string().optional(),
    cefr: z.enum(cefrLevels).optional(),
    frequency_rank: z.number().int().positive().optional(),
    image_ref: z.string().optional(),
    audio_ref: z.string().optional(),
    tags: z.array(z.string().min(1)).optional(),
    metadata: z.record(z.unknown()).optional(),
    senses: z.array(senseInputSchema).default([]),
    examples: z.array(exampleInputSchema).default([]),
    forms: z.array(formInputSchema).default([]),
    collocations: z.array(collocationInputSchema).default([]),
    relations: z.array(relationInputSchema).default([]),
  })
  .strict();

export const vocabFileSchema = z
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
        kind: z.literal("vocabulary"),
        title: z.string().min(1),
        slug: z.string().regex(slugRegex, "slug must be lowercase-kebab"),
      })
      .strict(),
    entries: z.array(entryInputSchema).min(1, "file must contain at least one entry"),
  })
  .strict();

export type VocabFileInput = z.infer<typeof vocabFileSchema>;
export type EntryInput = z.infer<typeof entryInputSchema>;
export type ExampleYamlInput = z.infer<typeof exampleInputSchema>;
