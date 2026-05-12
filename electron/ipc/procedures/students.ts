import { z } from "zod";
import { defineProcedure } from "../procedure";

const idInput = z.object({ id: z.number().int().positive() });
const avatarSeed = z.string().max(180_000);

const createInput = z.object({
  name: z.string().min(1).max(80),
  displayName: z.string().min(1).max(80).optional(),
  avatarSeed: avatarSeed.optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a 6-digit hex like #1a2b3c")
    .optional(),
  notes: z.string().max(2000).optional(),
});

const updateInput = z.object({
  id: z.number().int().positive(),
  patch: z.object({
    name: z.string().min(1).max(80).optional(),
    displayName: z.string().min(1).max(80).nullable().optional(),
    avatarSeed: avatarSeed.nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
});

const studentBookInput = z.object({
  studentId: z.number().int().positive(),
  bookId: z.number().int().positive(),
});

const assignedUnitIdsInput = z.object({
  studentId: z.number().int().positive(),
  bookId: z.number().int().positive().optional(),
});

const replaceAssignmentsInput = z.object({
  studentId: z.number().int().positive(),
  bookId: z.number().int().positive(),
  unitIds: z.array(z.number().int().positive()).max(200),
});

export const studentsProcedures = [
  defineProcedure({
    name: "students.listActive",
    input: z.void(),
    handler: (_input, ctx) => ctx.repos.students.listActive(),
  }),
  defineProcedure({
    name: "students.listAll",
    input: z.void(),
    handler: (_input, ctx) => ctx.repos.students.listAll(),
  }),
  defineProcedure({
    name: "students.getById",
    input: idInput,
    handler: ({ id }, ctx) => ctx.repos.students.getById(id),
  }),
  defineProcedure({
    name: "students.create",
    input: createInput,
    handler: (input, ctx) => ctx.repos.students.create(input),
  }),
  defineProcedure({
    name: "students.update",
    input: updateInput,
    handler: ({ id, patch }, ctx) => ctx.repos.students.update(id, patch),
  }),
  defineProcedure({
    name: "students.archive",
    input: idInput,
    handler: ({ id }, ctx) => {
      ctx.repos.students.archive(id);
      return { ok: true } as const;
    },
  }),
  defineProcedure({
    name: "students.restore",
    input: idInput,
    handler: ({ id }, ctx) => {
      ctx.repos.students.restore(id);
      return { ok: true } as const;
    },
  }),
  defineProcedure({
    name: "students.listAssignedBooks",
    input: z.object({ studentId: z.number().int().positive() }),
    handler: ({ studentId }, ctx) => ctx.repos.students.listAssignedBooks(studentId),
  }),
  defineProcedure({
    name: "students.listAssignedUnits",
    input: studentBookInput,
    handler: ({ studentId, bookId }, ctx) =>
      ctx.repos.students.listAssignedUnits(studentId, bookId),
  }),
  defineProcedure({
    name: "students.listAssignedUnitIds",
    input: assignedUnitIdsInput,
    handler: ({ studentId, bookId }, ctx) =>
      ctx.repos.students.listAssignedUnitIds(studentId, bookId),
  }),
  defineProcedure({
    name: "students.replaceUnitAssignments",
    input: replaceAssignmentsInput,
    handler: (input, ctx) => ctx.repos.students.replaceUnitAssignments(input),
  }),
];
