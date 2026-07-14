import { z } from "zod";
import { hashPin, isHashedPin, verifyPin } from "../../auth/pin";
import { defineProcedure } from "../procedure";

const idInput = z.object({ id: z.number().int().positive() });
const avatarSeed = z.string().max(180_000);
const pinSchema = z.string().min(4, "PIN must be at least 4 characters").max(32, "PIN is too long");

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

const studentPinInput = z.object({
  studentId: z.number().int().positive(),
});

const setupPinInput = studentPinInput.extend({
  pin: pinSchema,
});

const verifyPinInput = studentPinInput.extend({
  pin: pinSchema,
});

const changePinInput = studentPinInput.extend({
  currentPin: pinSchema,
  newPin: pinSchema,
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
    name: "students.hasPin",
    input: studentPinInput,
    handler: ({ studentId }, ctx) => {
      const student = ctx.repos.students.getById(studentId);
      return isHashedPin(student?.pinHash);
    },
  }),
  defineProcedure({
    name: "students.setupPin",
    input: setupPinInput,
    handler: ({ studentId, pin }, ctx) => {
      const student = ctx.repos.students.getById(studentId);
      if (!student) throw new Error(`Student ${studentId} not found`);
      if (isHashedPin(student.pinHash)) {
        throw new Error("Student PIN already set; change it instead");
      }
      ctx.repos.students.updatePin(studentId, hashPin(pin));
      return { ok: true } as const;
    },
  }),
  defineProcedure({
    name: "students.verifyPin",
    input: verifyPinInput,
    handler: ({ studentId, pin }, ctx) => {
      const student = ctx.repos.students.getById(studentId);
      if (!student || !isHashedPin(student.pinHash)) {
        return { ok: false, reason: "no_pin" } as const;
      }
      return verifyPin(pin, student.pinHash)
        ? ({ ok: true } as const)
        : ({ ok: false, reason: "invalid" } as const);
    },
  }),
  defineProcedure({
    name: "students.changePin",
    input: changePinInput,
    handler: ({ studentId, currentPin, newPin }, ctx) => {
      const student = ctx.repos.students.getById(studentId);
      if (!student || !isHashedPin(student.pinHash) || !verifyPin(currentPin, student.pinHash)) {
        throw new Error("Current student PIN is incorrect");
      }
      ctx.repos.students.updatePin(studentId, hashPin(newPin));
      return { ok: true } as const;
    },
  }),
  defineProcedure({
    name: "students.clearPin",
    input: studentPinInput,
    handler: ({ studentId }, ctx) => {
      ctx.repos.students.updatePin(studentId, null);
      return { ok: true } as const;
    },
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
