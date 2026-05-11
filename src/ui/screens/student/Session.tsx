import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  type Exercise,
  type ExerciseKind,
  buildDeck,
  defaultSessionSeed,
} from "@/modules/exercises";
import { Button } from "@/ui/components/Button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SessionPlayer,
  type SessionResult,
  type SessionResultPersistence,
} from "./session/SessionPlayer";

const SOUND_KEY = "rewards_sound_enabled";
const SESSION_COUNT_KEY = "session_default_count";
const SESSION_MODE_KEY = "session_default_mode";
const SESSION_SHUFFLE_KEY = "session_shuffle";

/**
 * Route screen: glues lesson data → exercise engine → SessionPlayer →
 * progress persistence (PR #8) → reward feedback (PR #9).
 *
 *   - On mount, opens a practice_sessions row.
 *   - On every answered exercise, calls progress.recordAnswer (writes
 *     learning_events + upserts item_progress via SM-2). The response
 *     surfaces freshly-unlocked achievements which flow back to the
 *     player as toast specs.
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

  const soundQ = useQuery({
    queryKey: ["settings", "get", SOUND_KEY],
    queryFn: () => api.settings.get<boolean>({ key: SOUND_KEY }),
  });

  const sessionCountQ = useQuery({
    queryKey: ["settings", "get", SESSION_COUNT_KEY],
    queryFn: () => api.settings.get<number>({ key: SESSION_COUNT_KEY }),
  });

  const sessionModeQ = useQuery({
    queryKey: ["settings", "get", SESSION_MODE_KEY],
    queryFn: () => api.settings.get<string>({ key: SESSION_MODE_KEY }),
  });

  const sessionShuffleQ = useQuery({
    queryKey: ["settings", "get", SESSION_SHUFFLE_KEY],
    queryFn: () => api.settings.get<boolean>({ key: SESSION_SHUFFLE_KEY }),
  });

  const sessionCount = normalizeSessionCount(sessionCountQ.data);
  const sessionMode = normalizeSessionMode(sessionModeQ.data);
  const exerciseKinds = useMemo(() => exerciseKindsForMode(sessionMode), [sessionMode]);
  const shuffleDeck = sessionShuffleQ.data !== false;
  const settingsLoading =
    sessionCountQ.isLoading || sessionModeQ.isLoading || sessionShuffleQ.isLoading;

  const sessionStart = useMutation({
    mutationFn: (input: { studentId: number }) =>
      api.progress.startSession({ studentId: input.studentId, mode: sessionMode }),
  });

  // Open the session exactly once when student + lesson are valid.
  // Using a ref so React 18 strict-mode double-invokes don't double-open.
  const openedFor = useRef<string | null>(null);
  const sessionId = sessionStart.data?.id ?? null;

  useEffect(() => {
    if (settingsLoading) return;
    if (!Number.isFinite(studentIdNum) || studentIdNum <= 0) return;
    const key = `${studentIdNum}:${lessonIdNum}:${seed}:${sessionMode}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    sessionStart.mutate({ studentId: studentIdNum });
  }, [settingsLoading, studentIdNum, lessonIdNum, seed, sessionMode, sessionStart.mutate]);

  const deck = useMemo<Exercise[]>(() => {
    if (!entriesQ.data || settingsLoading) return [];
    return buildDeck({
      entries: entriesQ.data,
      kinds: exerciseKinds,
      sessionSeed: seed,
      maxExercises: sessionCount,
      shuffle: shuffleDeck,
    }).exercises;
  }, [entriesQ.data, exerciseKinds, seed, sessionCount, shuffleDeck, settingsLoading]);

  const handleResult = useCallback(
    async (result: SessionResult): Promise<SessionResultPersistence | undefined> => {
      if (sessionId === null) return undefined; // session row not open yet — drop silently
      const response = await api.progress.recordAnswer({
        studentId: studentIdNum,
        sessionId,
        entryId: result.entryId,
        outcome: {
          correct: result.outcome.correct,
          feedback: result.outcome.feedback,
          selfGrade: result.outcome.selfGrade,
          selectedIndex: result.outcome.selectedIndex,
        },
        currentSessionRun: result.currentSessionRun,
      });
      return { unlockedAchievements: response.unlockedAchievements };
    },
    [sessionId, studentIdNum],
  );

  const exit = useCallback(() => {
    if (sessionId !== null) {
      void api.progress
        .endSession({ sessionId })
        .catch((err) => console.error("[Session] endSession failed", err))
        .finally(() => {
          // Refresh anything that reads progress + rewards so the home
          // screen due counts and unlocked achievements update before the
          // user sees them again.
          queryClient.invalidateQueries({ queryKey: ["progress"] });
          queryClient.invalidateQueries({ queryKey: ["rewards"] });
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

  if (lessonQ.isLoading || entriesQ.isLoading || settingsLoading) {
    return <p className="px-6 py-10 text-sm text-muted">Loading session…</p>;
  }

  const contextLabel = lessonQ.data
    ? `${lessonQ.data.title} · ${entriesQ.data?.length ?? 0} entries`
    : undefined;

  return (
    <SessionPlayer
      deck={deck}
      onExit={exit}
      onResult={handleResult}
      contextLabel={contextLabel}
      soundEnabled={soundQ.data === true}
    />
  );
}

function normalizeSessionCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 15;
  return Math.min(30, Math.max(5, Math.round(value)));
}

function normalizeSessionMode(value: unknown): "mixed" | "flashcard" | "multiple_choice" {
  return value === "flashcard" || value === "multiple_choice" || value === "mixed"
    ? value
    : "mixed";
}

function exerciseKindsForMode(mode: "mixed" | "flashcard" | "multiple_choice"): ExerciseKind[] {
  return mode === "mixed" ? ["flashcard", "multiple_choice"] : [mode];
}
