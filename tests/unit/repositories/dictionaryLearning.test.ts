import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import type { DictionaryEntry } from "../../../src/data/dictionary";
import { freshDb } from "../../helpers";

describe("dictionary learning repository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    const fresh = freshDb();
    db = fresh.db;
    repos = fresh.repos;
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("creates one learning item per student + dictionary key and records search history", () => {
    const student = repos.students.create({ name: "Alice" });
    const first = repos.dictionaryLearning.recordLookup({
      studentId: student.id,
      query: "achieve",
      entry: entry("achieve"),
    });
    const second = repos.dictionaryLearning.recordLookup({
      studentId: student.id,
      query: "achieved",
      entry: entry("achieve"),
    });

    expect(second.id).toBe(first.id);
    expect(repos.dictionaryLearning.listItems(student.id)).toHaveLength(1);
    expect(repos.dictionaryLearning.recentSearches(student.id, 5)).toHaveLength(2);
  });

  it("promotes after seven correct learning attempts, then three retention checks", () => {
    const student = repos.students.create({ name: "Alice" });
    const created = repos.dictionaryLearning.recordLookup({
      studentId: student.id,
      query: "achieve",
      entry: entry("achieve"),
    });

    let item = created;
    for (let i = 0; i < 7; i += 1) {
      const result = repos.dictionaryLearning.recordReview({
        studentId: student.id,
        itemId: item.id,
        stage: item.stage,
        correct: true,
        now: new Date(2026, 0, 1, 9, i),
      });
      item = result.item;
    }

    expect(item.status).toBe("short_term");
    expect(item.stage).toBe("retention");
    expect(item.correctInCycle).toBe(7);

    for (let i = 0; i < 3; i += 1) {
      const result = repos.dictionaryLearning.recordReview({
        studentId: student.id,
        itemId: item.id,
        stage: item.stage,
        correct: true,
        now: new Date(2026, 0, 2 + i, 9),
      });
      item = result.item;
    }

    expect(item.status).toBe("long_term");
    expect(item.shortTermCorrect).toBe(3);
    expect(item.score).toBe(100);
  });

  it("resets the cycle after any wrong answer", () => {
    const student = repos.students.create({ name: "Alice" });
    let item = repos.dictionaryLearning.recordLookup({
      studentId: student.id,
      query: "achieve",
      entry: entry("achieve"),
    });

    item = repos.dictionaryLearning.recordReview({
      studentId: student.id,
      itemId: item.id,
      stage: item.stage,
      correct: true,
    }).item;

    const reset = repos.dictionaryLearning.recordReview({
      studentId: student.id,
      itemId: item.id,
      stage: item.stage,
      correct: false,
      answer: "archive",
      expected: "achieve",
    });

    expect(reset.reset).toBe(true);
    expect(reset.item.status).toBe("learning");
    expect(reset.item.stage).toBe("flashcard");
    expect(reset.item.correctInCycle).toBe(0);
    expect(reset.item.totalWrong).toBe(1);
  });
});

function entry(headword: string): DictionaryEntry {
  return {
    key: headword,
    headword,
    posLabel: "verb",
    posKey: "verb",
    ipaUk: "/əˈtʃiːv/",
    ipaUs: "/əˈtʃiːv/",
    cefr: "B1",
    labels: [],
    senses: [
      {
        definitionEn: "to succeed in doing something",
        labels: [],
        examples: ["She worked hard to achieve her goal."],
      },
    ],
    examples: ["She worked hard to achieve her goal."],
    audio: [{ ref: "sound/achieve__gb_1.mp3", label: "UK", accent: "uk" }],
    images: [],
    related: [],
    source: { dictionary: "oald10", file: "oald10_og.mdx" },
    lessonEntries: [],
  };
}
