import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { books, enrollments, students, unitAssignments, units } from "../../../src/data/schema";
import type { Book, NewStudent, Student, Unit, UnitAssignment } from "../../../src/data/types";
import type { AppDatabase } from "../client";

export interface CreateStudentInput {
  name: string;
  displayName?: string;
  avatarSeed?: string;
  color?: string;
  notes?: string;
}

export interface UpdateStudentInput {
  name?: string;
  displayName?: string | null;
  avatarSeed?: string | null;
  color?: string | null;
  notes?: string | null;
}

export interface ReplaceUnitAssignmentsInput {
  studentId: number;
  bookId: number;
  unitIds: number[];
}

export function createStudentsRepository(db: AppDatabase) {
  return {
    listActive(): Student[] {
      return db.select().from(students).where(isNull(students.archivedAt)).all();
    },

    listAll(): Student[] {
      return db.select().from(students).all();
    },

    getById(id: number): Student | null {
      return db.select().from(students).where(eq(students.id, id)).get() ?? null;
    },

    create(input: CreateStudentInput): Student {
      const values: NewStudent = {
        name: input.name,
        displayName: input.displayName ?? null,
        avatarSeed: input.avatarSeed ?? null,
        color: input.color ?? null,
        notes: input.notes ?? null,
      };
      const row = db.insert(students).values(values).returning().get();
      if (!row) {
        throw new Error("Failed to insert student");
      }
      return row;
    },

    update(id: number, patch: UpdateStudentInput): Student {
      const row = db
        .update(students)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(students.id, id), isNull(students.archivedAt)))
        .returning()
        .get();
      if (!row) {
        throw new Error(`Student ${id} not found or archived`);
      }
      return row;
    },

    archive(id: number): void {
      db.update(students)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(students.id, id))
        .run();
    },

    restore(id: number): void {
      db.update(students)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(students.id, id))
        .run();
    },

    listAssignedBooks(studentId: number): Book[] {
      const rows = db
        .select({ book: books })
        .from(unitAssignments)
        .innerJoin(units, eq(units.id, unitAssignments.unitId))
        .innerJoin(books, eq(books.id, units.bookId))
        .where(
          and(eq(unitAssignments.studentId, studentId), eq(unitAssignments.status, "assigned")),
        )
        .orderBy(asc(books.code), asc(units.ordinal))
        .all();

      const byId = new Map<number, Book>();
      for (const row of rows) {
        if (!byId.has(row.book.id)) byId.set(row.book.id, row.book);
      }
      return [...byId.values()];
    },

    listAssignedUnits(studentId: number, bookId: number): Unit[] {
      return db
        .select({ unit: units })
        .from(unitAssignments)
        .innerJoin(units, eq(units.id, unitAssignments.unitId))
        .where(
          and(
            eq(unitAssignments.studentId, studentId),
            eq(unitAssignments.status, "assigned"),
            eq(units.bookId, bookId),
          ),
        )
        .orderBy(asc(units.ordinal))
        .all()
        .map((row) => row.unit);
    },

    listAssignedUnitIds(studentId: number, bookId?: number): number[] {
      const rows = bookId
        ? db
            .select({ unitId: unitAssignments.unitId })
            .from(unitAssignments)
            .innerJoin(units, eq(units.id, unitAssignments.unitId))
            .where(
              and(
                eq(unitAssignments.studentId, studentId),
                eq(unitAssignments.status, "assigned"),
                eq(units.bookId, bookId),
              ),
            )
            .orderBy(asc(units.ordinal))
            .all()
        : db
            .select({ unitId: unitAssignments.unitId })
            .from(unitAssignments)
            .innerJoin(units, eq(units.id, unitAssignments.unitId))
            .where(
              and(eq(unitAssignments.studentId, studentId), eq(unitAssignments.status, "assigned")),
            )
            .orderBy(asc(units.bookId), asc(units.ordinal))
            .all();
      return rows.map((row) => row.unitId);
    },

    listAssignments(studentId: number): UnitAssignment[] {
      return db
        .select()
        .from(unitAssignments)
        .where(eq(unitAssignments.studentId, studentId))
        .orderBy(asc(unitAssignments.assignedAt))
        .all();
    },

    replaceUnitAssignments(input: ReplaceUnitAssignmentsInput): UnitAssignment[] {
      const bookUnits = db
        .select({ id: units.id })
        .from(units)
        .where(eq(units.bookId, input.bookId))
        .orderBy(asc(units.ordinal))
        .all();
      const bookUnitIds = bookUnits.map((unit) => unit.id);
      const bookUnitIdSet = new Set(bookUnitIds);
      const uniqueRequested = [...new Set(input.unitIds)];

      for (const unitId of uniqueRequested) {
        if (!bookUnitIdSet.has(unitId)) {
          throw new Error(`Unit ${unitId} does not belong to book ${input.bookId}`);
        }
      }

      return db.transaction((tx) => {
        if (bookUnitIds.length > 0) {
          tx.delete(unitAssignments)
            .where(
              and(
                eq(unitAssignments.studentId, input.studentId),
                inArray(unitAssignments.unitId, bookUnitIds),
              ),
            )
            .run();
        }

        const currentUnitId = uniqueRequested[0] ?? null;
        tx.insert(enrollments)
          .values({
            studentId: input.studentId,
            bookId: input.bookId,
            currentUnitId,
            status: uniqueRequested.length > 0 ? "active" : "paused",
            completedAt: null,
          })
          .onConflictDoUpdate({
            target: [enrollments.studentId, enrollments.bookId],
            set: {
              currentUnitId,
              status: uniqueRequested.length > 0 ? "active" : "paused",
              completedAt: null,
            },
          })
          .run();

        if (uniqueRequested.length > 0) {
          tx.insert(unitAssignments)
            .values(
              uniqueRequested.map((unitId) => ({
                studentId: input.studentId,
                unitId,
                status: "assigned" as const,
              })),
            )
            .run();
        }

        if (uniqueRequested.length === 0) return [];
        return tx
          .select()
          .from(unitAssignments)
          .where(
            and(
              eq(unitAssignments.studentId, input.studentId),
              inArray(unitAssignments.unitId, uniqueRequested),
            ),
          )
          .orderBy(asc(unitAssignments.assignedAt))
          .all();
      });
    },
  };
}

export type StudentsRepository = ReturnType<typeof createStudentsRepository>;
