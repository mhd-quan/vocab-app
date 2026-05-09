import { and, eq, isNull } from "drizzle-orm";
import { students } from "../../../src/data/schema";
import type { NewStudent, Student } from "../../../src/data/types";
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
  };
}

export type StudentsRepository = ReturnType<typeof createStudentsRepository>;
