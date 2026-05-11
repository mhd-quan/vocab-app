import { and, asc, eq } from "drizzle-orm";
import { contentItems, grammarTopics } from "../../../src/data/schema";
import type { GrammarTopic } from "../../../src/data/types";
import type { AppDatabase } from "../client";
import type { UpsertAction } from "./vocab";

export interface UpsertGrammarTopicInput {
  lessonId: number;
  sourceId: string;
  slug: string;
  title: string;
  summaryMd?: string | null;
  explanationMd?: string | null;
  difficulty?: number | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  contentHash: string;
}

export interface UpsertGrammarTopicResult {
  topicId: number;
  action: UpsertAction;
}

export function createGrammarRepository(db: AppDatabase) {
  return {
    listByLesson(lessonId: number): GrammarTopic[] {
      return db
        .select()
        .from(grammarTopics)
        .where(eq(grammarTopics.lessonId, lessonId))
        .orderBy(asc(grammarTopics.slug))
        .all();
    },

    countByLesson(lessonId: number): number {
      const rows = db
        .select({ id: grammarTopics.id })
        .from(grammarTopics)
        .where(eq(grammarTopics.lessonId, lessonId))
        .all();
      return rows.length;
    },

    getById(id: number): GrammarTopic | null {
      return db.select().from(grammarTopics).where(eq(grammarTopics.id, id)).get() ?? null;
    },

    listIdsByLesson(lessonId: number): Array<{
      id: number;
      sourceId: string | null;
      contentHash: string | null;
    }> {
      return db
        .select({
          id: grammarTopics.id,
          sourceId: grammarTopics.sourceId,
          contentHash: grammarTopics.contentHash,
        })
        .from(grammarTopics)
        .where(eq(grammarTopics.lessonId, lessonId))
        .all();
    },

    upsertTopic(input: UpsertGrammarTopicInput): UpsertGrammarTopicResult {
      return db.transaction((tx) => {
        const existing = tx
          .select()
          .from(grammarTopics)
          .where(
            and(
              eq(grammarTopics.lessonId, input.lessonId),
              eq(grammarTopics.sourceId, input.sourceId),
            ),
          )
          .get();

        if (existing && existing.contentHash === input.contentHash) {
          return { topicId: existing.id, action: "skipped" as const };
        }

        const now = new Date();
        if (existing) {
          tx.update(grammarTopics)
            .set({
              slug: input.slug,
              title: input.title,
              summaryMd: input.summaryMd ?? null,
              explanationMd: input.explanationMd ?? null,
              difficulty: input.difficulty ?? null,
              tags: input.tags ?? null,
              metadata: input.metadata ?? null,
              contentHash: input.contentHash,
              updatedAt: now,
            })
            .where(eq(grammarTopics.id, existing.id))
            .run();
          return { topicId: existing.id, action: "updated" as const };
        }

        const inserted = tx
          .insert(grammarTopics)
          .values({
            lessonId: input.lessonId,
            sourceId: input.sourceId,
            slug: input.slug,
            title: input.title,
            summaryMd: input.summaryMd ?? null,
            explanationMd: input.explanationMd ?? null,
            difficulty: input.difficulty ?? null,
            tags: input.tags ?? null,
            metadata: input.metadata ?? null,
            contentHash: input.contentHash,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: grammarTopics.id })
          .get();
        if (!inserted) throw new Error("Failed to insert grammar topic");

        tx.insert(contentItems)
          .values({
            kind: "grammar_topic",
            refTable: "grammar_topics",
            refId: inserted.id,
            lessonId: input.lessonId,
            tags: input.tags ?? null,
            metadata: input.metadata ?? null,
          })
          .run();

        return { topicId: inserted.id, action: "inserted" as const };
      });
    },

    deleteById(id: number): void {
      db.transaction((tx) => {
        tx.delete(contentItems)
          .where(and(eq(contentItems.refTable, "grammar_topics"), eq(contentItems.refId, id)))
          .run();
        tx.delete(grammarTopics).where(eq(grammarTopics.id, id)).run();
      });
    },
  };
}

export type GrammarRepository = ReturnType<typeof createGrammarRepository>;
