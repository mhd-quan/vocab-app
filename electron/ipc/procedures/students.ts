import { z } from "zod";
import { defineProcedure } from "../procedure";

const idInput = z.object({ id: z.number().int().positive() });

const createInput = z.object({
  name: z.string().min(1).max(80),
  displayName: z.string().min(1).max(80).optional(),
  avatarSeed: z.string().max(64).optional(),
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
    avatarSeed: z.string().max(64).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
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
];
