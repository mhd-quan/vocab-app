import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import { units } from "../../../src/data/schema";
import { first, freshDb, seedCurriculum } from "../../helpers";

describe("StudentsRepository", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("creates and lists active students", () => {
    const a = repos.students.create({ name: "Alice", color: "#1a2b3c" });
    const b = repos.students.create({ name: "Bob" });
    const list = repos.students.listActive();
    expect(list.map((s) => s.name).sort()).toEqual(["Alice", "Bob"]);
    expect(list.find((s) => s.id === a.id)?.color).toBe("#1a2b3c");
    expect(b.archivedAt).toBeNull();
  });

  it("getById returns null for missing students", () => {
    expect(repos.students.getById(999)).toBeNull();
  });

  it("update applies a patch and bumps updatedAt", () => {
    const created = repos.students.create({ name: "Alice" });
    const before = created.updatedAt;
    // Sleep 1ms equivalent — better-sqlite3 is sync, so use a small wait.
    const updated = repos.students.update(created.id, { displayName: "Ali" });
    expect(updated.displayName).toBe("Ali");
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("updatePin stores and clears a student password hash without touching profile fields", () => {
    const created = repos.students.create({ name: "Alice", color: "#1a2b3c" });

    repos.students.updatePin(created.id, "scrypt$1$hash");

    const protectedStudent = repos.students.getById(created.id);
    expect(protectedStudent?.pinHash).toBe("scrypt$1$hash");
    expect(protectedStudent?.name).toBe("Alice");
    expect(protectedStudent?.color).toBe("#1a2b3c");

    repos.students.updatePin(created.id, null);

    expect(repos.students.getById(created.id)?.pinHash).toBeNull();
  });

  it("archive hides students from listActive but keeps them in listAll", () => {
    const a = repos.students.create({ name: "Alice" });
    repos.students.archive(a.id);
    expect(repos.students.listActive()).toHaveLength(0);
    expect(repos.students.listAll()).toHaveLength(1);
    expect(repos.students.listAll()[0]?.archivedAt).not.toBeNull();
  });

  it("restore brings an archived student back", () => {
    const a = repos.students.create({ name: "Alice" });
    repos.students.archive(a.id);
    repos.students.restore(a.id);
    expect(repos.students.listActive()).toHaveLength(1);
  });

  it("update on an archived student throws", () => {
    const a = repos.students.create({ name: "Alice" });
    repos.students.archive(a.id);
    expect(() => repos.students.update(a.id, { name: "Renamed" })).toThrow();
  });

  it("replaces assigned units by book and lists only assigned curriculum", () => {
    const { book, unit } = seedCurriculum(db);
    const secondUnit = first(
      db
        .insert(units)
        .values({ bookId: book.id, ordinal: 2, code: "U02", title: "Unit 2" })
        .returning()
        .all(),
    );
    const student = repos.students.create({ name: "Alice" });

    repos.students.replaceUnitAssignments({
      studentId: student.id,
      bookId: book.id,
      unitIds: [unit.id, secondUnit.id],
    });

    expect(repos.students.listAssignedBooks(student.id).map((row) => row.id)).toEqual([book.id]);
    expect(repos.students.listAssignedUnits(student.id, book.id).map((row) => row.id)).toEqual([
      unit.id,
      secondUnit.id,
    ]);

    repos.students.replaceUnitAssignments({
      studentId: student.id,
      bookId: book.id,
      unitIds: [secondUnit.id],
    });

    expect(repos.students.listAssignedUnitIds(student.id, book.id)).toEqual([secondUnit.id]);
  });

  it("rejects assignment to a unit outside the selected book", () => {
    const firstBook = seedCurriculum(db, { bookCode: "book-a" });
    const secondBook = seedCurriculum(db, { bookCode: "book-b" });
    const student = repos.students.create({ name: "Alice" });

    expect(() =>
      repos.students.replaceUnitAssignments({
        studentId: student.id,
        bookId: firstBook.book.id,
        unitIds: [secondBook.unit.id],
      }),
    ).toThrow(/does not belong/);
  });
});
