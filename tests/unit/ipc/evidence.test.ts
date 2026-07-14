import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type AppDatabase, closeDatabase } from "../../../electron/db";
import type { Repositories } from "../../../electron/db/repositories";
import type { TutorEvidenceOverviewRow } from "../../../electron/db/repositories/evidence";
import { allProcedures } from "../../../electron/ipc";
import { freshDb } from "../../helpers";

function findProcedure(name: string) {
  const procedure = allProcedures.find((candidate) => candidate.name === name);
  if (!procedure) throw new Error(`Procedure ${name} not registered`);
  return procedure;
}

describe("evidence.* procedures", () => {
  let db: AppDatabase;
  let repos: Repositories;

  beforeEach(() => {
    ({ db, repos } = freshDb());
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it("tutorOverview exposes aggregate rows for active students only", async () => {
    const alice = repos.students.create({ name: "Alice" });
    const quiet = repos.students.create({ name: "Quiet" });
    const archived = repos.students.create({ name: "Archived" });
    const aliceSession = repos.progress.startSession({ studentId: alice.id, mode: "mixed" });
    const archivedSession = repos.progress.startSession({
      studentId: archived.id,
      mode: "mixed",
    });
    repos.evidence.recordEvent({
      studentId: alice.id,
      sessionId: aliceSession.id,
      kind: "window_focus_returned",
      durationMs: 1_000,
    });
    repos.evidence.recordEvent({
      studentId: archived.id,
      sessionId: archivedSession.id,
      kind: "camera_snapshot",
    });
    repos.students.archive(archived.id);

    const procedure = findProcedure("evidence.tutorOverview");
    const output = (await procedure.handler(procedure.inputSchema.parse({}), {
      repos,
    })) as TutorEvidenceOverviewRow[];

    expect(output.map((row) => row.student.id)).toEqual([alice.id, quiet.id]);
    expect(output[0]).toMatchObject({
      sessionCount: 1,
      avgAttentionScore: 92,
      totalReviewFlags: 1,
      focusLossCount: 1,
    });
    expect(output[1]).toMatchObject({
      sessionCount: 0,
      avgAttentionScore: null,
      totalReviewFlags: 0,
      latestSessionAt: null,
    });
  });
});
