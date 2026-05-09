import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { books, lessons, units } from "../../../src/data/schema";
import { first, freshDb } from "../../helpers";

describe("CurriculumRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("listBooks returns books sorted by code", () => {
    db.insert(books).values({ code: "destination-b2", title: "B2" }).run();
    db.insert(books).values({ code: "destination-b1", title: "B1" }).run();
    const list = repos.curriculum.listBooks();
    expect(list.map((b) => b.code)).toEqual(["destination-b1", "destination-b2"]);
  });

  it("getBookByCode returns the matching book or null", () => {
    db.insert(books).values({ code: "destination-b1", title: "B1" }).run();
    expect(repos.curriculum.getBookByCode("destination-b1")?.title).toBe("B1");
    expect(repos.curriculum.getBookByCode("missing")).toBeNull();
  });

  it("listUnitsByBook orders units by ordinal", () => {
    const book = first(db.insert(books).values({ code: "b1", title: "B1" }).returning().all());
    db.insert(units).values({ bookId: book.id, ordinal: 2, code: "U02", title: "U2" }).run();
    db.insert(units).values({ bookId: book.id, ordinal: 1, code: "U01", title: "U1" }).run();

    const list = repos.curriculum.listUnitsByBook(book.id);
    expect(list.map((u) => u.ordinal)).toEqual([1, 2]);
  });

  it("listLessonsByUnit filters by kind when provided", () => {
    const book = first(db.insert(books).values({ code: "b1", title: "B1" }).returning().all());
    const unit = first(
      db
        .insert(units)
        .values({ bookId: book.id, ordinal: 1, code: "U01", title: "U1" })
        .returning()
        .all(),
    );
    db.insert(lessons)
      .values({ unitId: unit.id, ordinal: 1, kind: "vocabulary", title: "V", slug: "v" })
      .run();
    db.insert(lessons)
      .values({ unitId: unit.id, ordinal: 2, kind: "grammar", title: "G", slug: "g" })
      .run();

    expect(repos.curriculum.listLessonsByUnit(unit.id)).toHaveLength(2);
    expect(repos.curriculum.listLessonsByUnit(unit.id, "vocabulary")).toHaveLength(1);
    expect(repos.curriculum.listLessonsByUnit(unit.id, "grammar")[0]?.slug).toBe("g");
  });
});
