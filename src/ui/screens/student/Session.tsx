import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { type Exercise, buildDeck, defaultSessionSeed } from "@/modules/exercises";
import { Button } from "@/ui/components/Button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SessionPlayer, type SessionResult } from "./session/SessionPlayer";

/**
 * Route screen: glues lesson data → exercise engine → SessionPlayer →
 * progress persistence (PR #8).
 *
 *   - On mount, opens a practice_sessions row.
 *   - On every answered exercise, calls progress.recordAnswer (writes
 *     learning_events + upserts item_progress via SM-2).
 *   - On exit, finalises the session row with stats.
 *
 * The deck is built once per (lesson, seed) pair so re-renders don't
 * reshuffle out from under the player.
 */
export function StudentSession() {
  const { studentId, lessonId } = useParams({
    from: "/student/profile/$studentId/session/$lessonId",
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lessonIdNum = Number(lessonId);
  const studentIdNum = Number(studentId);

  const [seed] = useState(() => defaultSessionSeed(lessonIdNum));

  const lessonQ = useQuery({
    queryKey: queryKeys.curriculum.lessons(lessonIdNum),
    queryFn: () => api.curriculum.getLessonById({ id: lessonIdNum }),
    enabled: Number.isFinite(lessonIdNum) && lessonIdNum > 0,
  });

  const entriesQ = useQuery({
    queryKey: queryKeys.vocab.full(lessonIdNum),
    queryFn: () => api.vocab.listFullByLesson({ lessonId: lessonIdNum }),
    enabled: Number.isFinite(lessonIdNum) && lessonIdNum > 0,
  });

  const sessionStart = useMutation({
    mutationFn: (input: { studentId: number }) =>
      api.progress.startSession({ studentId: input.studentId, mode: "mixed" }),
  });

  // Open the session exactly once when student + lesson are valid.
  // Using a ref so React 18 strict-mode double-invokes don't double-open.
  const openedFor = useRef<string | null>(null);
  const sessionId = sessionStart.data?.id ?? null;

  useEffect(() => {
    if (!Number.isFinite(studentIdNum) || studentIdNum <= 0) return;
    const key = `${studentIdNum}:${lessonIdNum}:${seed}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    sessionStart.mutate({ studentId: studentIdNum });
  }, [studentIdNum, lessonIdNum, seed, sessionStart.mutate]);

  const deck = useMemo<Exercise[]>(() => {
    if (!entriesQ.data) return [];
    return buildDeck({
      entries: entriesQ.data,
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: seed,
    }).exercises;
  }, [entriesQ.data, seed]);

  const handleResult = useCallback(
    async (result: SessionResult) => {
      if (sessionId === null) return; // session row not open yet — drop silently
      await api.progress.recordAnswer({
        studentId: studentIdNum,
        sessionId,
        entryId: result.entryId,
        outcome: {
          correct: result.outcome.correct,
          feedback: result.outcome.feedback,
          selfGrade: result.outcome.selfGrade,
          selectedIndex: result.outcome.selectedIndex,
        },
      });
    },
    [sessionId, studentIdNum],
  );

  const exit = useCallback(() => {
    if (sessionId !== null) {
      void api.progress
        .endSession({ sessionId })
        .catch((err) => console.error("[Session] endSession failed", err))
        .finally(() => {
          // Refresh anything that reads progress so the home screen due
          // counts update before the user sees them again.
          queryClient.invalidateQueries({ queryKey: ["progress"] });
        });
    }
    void navigate({
      to: "/student/profile/$studentId",
      params: { studentId: String(studentIdNum) },
    });
  }, [sessionId, studentIdNum, navigate, queryClient]);

  if (!Number.isFinite(lessonIdNum) || lessonIdNum <= 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <p className="text-sm text-danger">Invalid lesson.</p>
        <Button className="mt-4" variant="secondary" onClick={exit}>
          Back
        </Button>
      </div>
    );
  }

  if (lessonQ.isLoading || entriesQ.isLoading) {
    return <p className="px-6 py-10 text-sm text-muted">Loading session…</p>;
  }

  const contextLabel = lessonQ.data
    ? `${lessonQ.data.title} · ${entriesQ.data?.length ?? 0} entries`
    : undefined;

  return (
    <SessionPlayer deck={deck} onExit={exit} onResult={handleResult} contextLabel={contextLabel} />
  );
}
