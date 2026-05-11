import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { ImportVocabUseCase } from "../../../src/application/import";
import { first, freshDb } from "../../helpers";

function writeYaml(dir: string, name: string, body: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, body, "utf8");
  return filePath;
}

const FILE_V1 = `
book: destination-b1
book_title: Destination B1
unit: { ordinal: 1, code: U01, title: People & Relationships }
lesson:
  ordinal: 1
  kind: vocabulary
  title: Family
  slug: family
entries:
  - id: relative-noun
    headword: relative
    pos: noun
    cefr: B1
    senses:
      - definition_en: a member of your family
    examples:
      - text: I have many {{relatives}} in Hanoi.
    forms:
      - kind: plural
        text: relatives
  - id: stubborn-adjective
    headword: stubborn
    pos: adjective
    senses:
      - definition_en: refusing to change your mind
`;

const FILE_V2_MODIFIED = `
book: destination-b1
book_title: Destination B1
unit: { ordinal: 1, code: U01, title: People & Relationships }
lesson:
  ordinal: 1
  kind: vocabulary
  title: Family
  slug: family
entries:
  - id: relative-noun
    headword: relative
    pos: noun
    cefr: B1
    senses:
      - definition_en: a member of your family (UPDATED)
    examples:
      - text: I have many {{relatives}} in Hanoi.
    forms:
      - kind: plural
        text: relatives
  - id: stubborn-adjective
    headword: stubborn
    pos: adjective
    senses:
      - definition_en: refusing to change your mind
`;

const FILE_INVALID_YAML = "this: is: not: valid: yaml: : :\n  - [unbalanced";

const FILE_BAD_SCHEMA = `
book: destination-b1
unit: { ordinal: 1, code: U01, title: U }
lesson:
  ordinal: 1
  kind: vocabulary
  title: L
  slug: l
entries:
  - headword: x
    pos: not-a-real-pos
`;

const FILE_WITHOUT_BOOK_TITLE = `
book: destination-b1
unit: { ordinal: 1, code: U01, title: People & Relationships }
lesson:
  ordinal: 1
  kind: vocabulary
  title: Family
  slug: family
entries:
  - id: relative-noun
    headword: relative
    pos: noun
    senses:
      - definition_en: a member of your family
`;

describe("ImportVocabUseCase", () => {
  let db: AppDatabase;
  let repos: Repositories;
  let usecase: ImportVocabUseCase;
  let tmpDir: string;

  beforeEach(() => {
    ({ db, repos } = freshDb());
    usecase = new ImportVocabUseCase({ repos });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-app-import-"));
  });

  afterEach(() => {
    closeDatabase(db);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("inserts the curriculum + every entry on a fresh DB", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    const result = await usecase.importFile(file);

    expect(result.status).toBe("success");
    expect(result.stats).toEqual({ inserted: 2, updated: 0, skipped: 0, failed: 0 });
    expect(result.bookCode).toBe("destination-b1");
    expect(result.unitCode).toBe("U01");
    expect(result.lessonSlug).toBe("family");

    const book = repos.curriculum.getBookByCode("destination-b1");
    if (!book) throw new Error("book not found");
    expect(book.title).toBe("Destination B1");
    const units = repos.curriculum.listUnitsByBook(book.id);
    expect(units).toHaveLength(1);
    const lessons = repos.curriculum.listLessonsByUnit(first(units).id);
    expect(lessons).toHaveLength(1);
    const entries = repos.vocab.listFullByLesson(first(lessons).id);
    expect(entries.map((e) => e.headword).sort()).toEqual(["relative", "stubborn"]);

    const relative = entries.find((e) => e.headword === "relative");
    if (!relative) throw new Error("relative entry not found");
    expect(relative.senses).toHaveLength(1);
    expect(relative.examples[0]?.clozeTarget).toBe("relatives");
    expect(relative.forms).toHaveLength(1);
  });

  it("re-importing an unchanged file is a no-op (skipped_unchanged)", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);
    const second = await usecase.importFile(file);
    expect(second.status).toBe("skipped_unchanged");
    expect(second.stats).toEqual({ inserted: 0, updated: 0, skipped: 0, failed: 0 });
  });

  it("--force re-runs even when the file hash matches", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);
    const second = await usecase.importFile(file, { force: true });
    expect(second.status).toBe("success");
    // Entries are unchanged at row level → all skipped.
    expect(second.stats).toEqual({ inserted: 0, updated: 0, skipped: 2, failed: 0 });
  });

  it("editing one entry: only that row is updated, the rest skipped", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);

    fs.writeFileSync(file, FILE_V2_MODIFIED, "utf8");
    const second = await usecase.importFile(file);

    expect(second.status).toBe("success");
    expect(second.stats).toEqual({ inserted: 0, updated: 1, skipped: 1, failed: 0 });
    const updatedItem = second.items.find((i) => i.sourceId === "relative-noun");
    expect(updatedItem?.action).toBe("updated");
    const skippedItem = second.items.find((i) => i.sourceId === "stubborn-adjective");
    expect(skippedItem?.action).toBe("skipped");

    const unit = first(repos.curriculum.listUnitsByBook(1));
    const lesson = first(repos.curriculum.listLessonsByUnit(unit.id));
    const relative = repos.vocab.listFullByLesson(lesson.id).find((e) => e.headword === "relative");
    if (!relative) throw new Error("relative not found");
    expect(relative.senses[0]?.definitionEn).toContain("UPDATED");
  });

  it("dry-run does not modify the DB", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    const planResult = await usecase.importFile(file, { dryRun: true });

    expect(planResult.stats.inserted).toBe(2);
    expect(repos.curriculum.listBooks()).toHaveLength(0);

    const realResult = await usecase.importFile(file);
    expect(realResult.stats.inserted).toBe(2);
  });

  it("dry-run on existing data classifies plan correctly", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);

    fs.writeFileSync(file, FILE_V2_MODIFIED, "utf8");
    const plan = await usecase.importFile(file, { dryRun: true });
    expect(plan.stats.updated).toBe(1);
    expect(plan.stats.skipped).toBe(1);
    expect(plan.stats.inserted).toBe(0);

    // DB still on V1.
    const unit = first(repos.curriculum.listUnitsByBook(1));
    const lesson = first(repos.curriculum.listLessonsByUnit(unit.id));
    const relative = repos.vocab.listFullByLesson(lesson.id).find((e) => e.headword === "relative");
    if (!relative) throw new Error("relative not found");
    expect(relative.senses[0]?.definitionEn).not.toContain("UPDATED");
  });

  it("logs an import_runs row + import_items per entry on success", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);

    const run = repos.imports.findLatestSuccessful(path.resolve(file));
    expect(run).not.toBeNull();
    expect(run?.status).toBe("success");
    expect(run?.stats).toMatchObject({ inserted: 2 });
    expect(run?.finishedAt).not.toBeNull();
  });

  it("invalid YAML returns failed status without partial writes", async () => {
    const file = writeYaml(tmpDir, "bad.yaml", FILE_INVALID_YAML);
    const result = await usecase.importFile(file);
    expect(result.status).toBe("failed");
    expect(result.errors[0]?.message).toMatch(/YAML/i);
    expect(repos.curriculum.listBooks()).toHaveLength(0);
  });

  it("schema validation errors fail fast without writes", async () => {
    const file = writeYaml(tmpDir, "bad.yaml", FILE_BAD_SCHEMA);
    const result = await usecase.importFile(file);
    expect(result.status).toBe("failed");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(repos.curriculum.listBooks()).toHaveLength(0);
  });

  it("missing file is captured as a file-level error", async () => {
    const result = await usecase.importFile(path.join(tmpDir, "missing.yaml"));
    expect(result.status).toBe("failed");
    expect(result.errors[0]?.message).toMatch(/Cannot read file/);
  });

  it("creates a content_items row for every inserted vocab_entry", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);

    const refs = db.$sqlite
      .prepare("SELECT kind, ref_table, ref_id FROM content_items")
      .all() as Array<{
      kind: string;
      ref_table: string;
      ref_id: number;
    }>;
    expect(refs).toHaveLength(2);
    expect(refs.every((r) => r.kind === "vocab_entry")).toBe(true);
  });

  it("updating an entry preserves its content_items row (no duplicate)", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_V1);
    await usecase.importFile(file);
    fs.writeFileSync(file, FILE_V2_MODIFIED, "utf8");
    await usecase.importFile(file);

    const count = (
      db.$sqlite.prepare("SELECT COUNT(*) AS n FROM content_items").get() as {
        n: number;
      }
    ).n;
    expect(count).toBe(2);
  });

  it("preserves UI-edited book titles when YAML omits book_title", async () => {
    const file = writeYaml(tmpDir, "u01.yaml", FILE_WITHOUT_BOOK_TITLE);
    await usecase.importFile(file);
    const book = repos.curriculum.getBookByCode("destination-b1");
    if (!book) throw new Error("book not found");

    repos.curriculum.updateBookTitle(book.id, "Custom Title");
    await usecase.importFile(file, { force: true });

    expect(repos.curriculum.getBookByCode("destination-b1")?.title).toBe("Custom Title");
  });
});
