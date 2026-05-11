import type {
  CollocationInput,
  ExampleInput,
  FormInput,
  RelationInput,
  SenseInput,
  UpsertVocabEntryInput,
} from "../../../electron/db/repositories";
import { hashContent } from "./hash";
import {
  type EntryInput,
  type ExampleYamlInput,
  type VocabFileInput,
  vocabFileSchema,
} from "./vocab.schema";

export interface ParsedVocabFile {
  book: string;
  bookTitle?: string;
  unit: VocabFileInput["unit"];
  lesson: VocabFileInput["lesson"];
  entries: ParsedVocabEntry[];
}

export interface ParsedVocabEntry {
  sourceId: string;
  contentHash: string;
  /** The raw entry input — useful for diagnostics. */
  raw: EntryInput;
  /** Ready to feed `vocab.upsertEntryWithChildren` once `lessonId` is known. */
  toUpsertInput: (lessonId: number) => UpsertVocabEntryInput;
}

const CLOZE_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

export class VocabParseError extends Error {
  constructor(
    public message: string,
    public readonly sourceId?: string,
  ) {
    super(message);
    this.name = "VocabParseError";
  }
}

/**
 * Validate + transform a YAML payload into the shape the repositories
 * expect. Throws `VocabParseError` with a `sourceId` for entry-level
 * problems so the import use case can log them per-row.
 */
export function parseVocabFile(rawData: unknown): ParsedVocabFile {
  const parsed = vocabFileSchema.parse(rawData);

  const entries = parsed.entries.map((rawEntry) => parseEntry(rawEntry));

  // Detect duplicate sourceIds within the file.
  const seenIds = new Set<string>();
  for (const entry of entries) {
    if (seenIds.has(entry.sourceId)) {
      throw new VocabParseError(`Duplicate entry id "${entry.sourceId}" in file`, entry.sourceId);
    }
    seenIds.add(entry.sourceId);
  }

  return {
    book: parsed.book,
    bookTitle: parsed.book_title,
    unit: parsed.unit,
    lesson: parsed.lesson,
    entries,
  };
}

function parseEntry(input: EntryInput): ParsedVocabEntry {
  const sourceId = input.id ?? defaultSourceId(input.headword, input.pos);

  const examples = input.examples.map((ex, index) => parseExample(ex, index, sourceId));
  const senses: SenseInput[] = input.senses.map((s, index) => ({
    ordinal: index,
    definitionEn: s.definition_en ?? null,
    definitionVi: s.definition_vi ?? null,
    register: s.register ?? null,
    domain: s.domain ?? null,
    notesMd: s.notes_md ?? null,
  }));
  const forms: FormInput[] = input.forms.map((f) => ({
    kind: f.kind,
    formText: f.text,
    ipa: f.ipa ?? null,
  }));
  const collocations: CollocationInput[] = input.collocations.map((c) => ({
    collocation: c.collocation,
    pattern: c.pattern ?? null,
    exampleText: c.example ?? null,
    notesMd: c.notes_md ?? null,
  }));
  const relations: RelationInput[] = input.relations.map((r) => ({
    relation: r.relation,
    relatedText: r.text ?? null,
    relatedEntryId: null,
  }));

  // Hash the canonical, post-transform shape — order-insensitive,
  // independent of the YAML serializer's whitespace choices.
  const contentHash = hashContent({
    sourceId,
    headword: input.headword,
    lemma: input.lemma,
    pos: input.pos,
    ipa: input.ipa,
    cefr: input.cefr,
    frequencyRank: input.frequency_rank,
    imageRef: input.image_ref,
    audioRef: input.audio_ref,
    tags: input.tags,
    metadata: input.metadata,
    senses,
    examples,
    forms,
    collocations,
    relations,
  });

  return {
    sourceId,
    contentHash,
    raw: input,
    toUpsertInput: (lessonId: number) => ({
      lessonId,
      sourceId,
      contentHash,
      headword: input.headword,
      lemma: input.lemma ?? null,
      pos: input.pos,
      ipa: input.ipa ?? null,
      cefrLevel: input.cefr ?? null,
      frequencyRank: input.frequency_rank ?? null,
      imageRef: input.image_ref ?? null,
      audioRef: input.audio_ref ?? null,
      tags: input.tags ?? null,
      metadata: input.metadata ?? null,
      senses,
      examples,
      forms,
      collocations,
      relations,
    }),
  };
}

function parseExample(input: ExampleYamlInput, index: number, sourceId: string): ExampleInput {
  const matches = [...input.text.matchAll(CLOZE_REGEX)];
  if (matches.length > 1) {
    throw new VocabParseError(
      `Example #${index + 1} for "${sourceId}" has ${matches.length} {{cloze}} markers; only one is supported`,
      sourceId,
    );
  }
  const inferred = matches[0]?.[1]?.trim();

  if (input.cloze_target && inferred && input.cloze_target !== inferred) {
    throw new VocabParseError(
      `Example #${index + 1} for "${sourceId}": cloze_target "${input.cloze_target}" does not match {{${inferred}}} marker in text`,
      sourceId,
    );
  }

  const clozeTarget = input.cloze_target ?? inferred ?? null;

  return {
    ordinal: index,
    text: input.text,
    translation: input.translation ?? null,
    clozeTarget,
    clozeHint: input.cloze_hint ?? null,
    audioRef: input.audio_ref ?? null,
    sourceRef: input.source_ref ?? null,
  };
}

/** lowercase-kebab fallback when the author didn't provide `id`. */
function defaultSourceId(headword: string, pos: string): string {
  const slug = headword
    .toLowerCase()
    .normalize("NFKD")
    // biome-ignore lint/suspicious/noMisleadingCharacterClass: stripping diacritics
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}-${pos}` : pos;
}
