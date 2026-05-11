import type { UpsertGrammarTopicInput } from "../../../electron/db/repositories";
import { type GrammarFileInput, type GrammarTopicInput, grammarFileSchema } from "./grammar.schema";
import { hashContent } from "./hash";

export interface ParsedGrammarFile {
  book: string;
  bookTitle?: string;
  unit: GrammarFileInput["unit"];
  lesson: GrammarFileInput["lesson"];
  topics: ParsedGrammarTopic[];
}

export interface ParsedGrammarTopic {
  sourceId: string;
  contentHash: string;
  raw: GrammarTopicInput;
  toUpsertInput: (lessonId: number) => UpsertGrammarTopicInput;
}

export class GrammarParseError extends Error {
  constructor(
    public message: string,
    public readonly sourceId?: string,
  ) {
    super(message);
    this.name = "GrammarParseError";
  }
}

export function parseGrammarFile(rawData: unknown): ParsedGrammarFile {
  const parsed = grammarFileSchema.parse(rawData);
  const topics = parsed.topics.map((topic) => parseTopic(topic));

  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const topic of topics) {
    if (seenIds.has(topic.sourceId)) {
      throw new GrammarParseError(`Duplicate topic id "${topic.sourceId}" in file`, topic.sourceId);
    }
    if (seenSlugs.has(topic.raw.slug)) {
      throw new GrammarParseError(
        `Duplicate topic slug "${topic.raw.slug}" in file`,
        topic.sourceId,
      );
    }
    seenIds.add(topic.sourceId);
    seenSlugs.add(topic.raw.slug);
  }

  return {
    book: parsed.book,
    bookTitle: parsed.book_title,
    unit: parsed.unit,
    lesson: parsed.lesson,
    topics,
  };
}

function parseTopic(input: GrammarTopicInput): ParsedGrammarTopic {
  const sourceId = input.id ?? input.slug;
  const metadata = compactMetadata({
    ...(input.metadata ?? {}),
    patterns: input.patterns,
    examples: input.examples,
    common_mistakes: input.common_mistakes,
    checks: input.checks,
  });

  const contentHash = hashContent({
    sourceId,
    slug: input.slug,
    title: input.title,
    summaryMd: input.summary_md,
    explanationMd: input.explanation_md,
    difficulty: input.difficulty,
    tags: input.tags,
    metadata,
  });

  return {
    sourceId,
    contentHash,
    raw: input,
    toUpsertInput: (lessonId: number) => ({
      lessonId,
      sourceId,
      slug: input.slug,
      title: input.title,
      summaryMd: input.summary_md ?? null,
      explanationMd: input.explanation_md ?? null,
      difficulty: input.difficulty ?? null,
      tags: input.tags ?? null,
      metadata,
      contentHash,
    }),
  };
}

function compactMetadata(input: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}
