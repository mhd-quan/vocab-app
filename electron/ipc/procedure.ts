import type { z } from "zod";
import type { Repositories } from "../db/repositories";

export interface ProcedureContext {
  repos: Repositories;
}

export interface Procedure<TInput, TOutput> {
  name: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ProcedureContext) => TOutput | Promise<TOutput>;
}

export type AnyProcedure = Procedure<unknown, unknown>;

/**
 * Define an IPC procedure: a single channel with a Zod-validated input and a
 * pure handler. Procedures don't know about Electron — they're plain
 * functions, which is what makes them testable and lets the registry layer
 * own all transport concerns.
 *
 * Usage:
 *
 *   defineProcedure({
 *     name: "vocab.listByLesson",
 *     input: z.object({ lessonId: z.number().int() }),
 *     handler: ({ lessonId }, ctx) => ctx.repos.vocab.listByLesson(lessonId),
 *   });
 */
export function defineProcedure<TInput, TOutput>(spec: {
  name: string;
  input: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ProcedureContext) => TOutput | Promise<TOutput>;
}): Procedure<TInput, TOutput> {
  return {
    name: spec.name,
    inputSchema: spec.input,
    handler: spec.handler,
  };
}
