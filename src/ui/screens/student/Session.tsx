import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { type Exercise, buildDeck, defaultSessionSeed } from "@/modules/exercises";
import {
  exerciseKindsForMode,
  normalizeExerciseSessionMode,
  practiceModeForExerciseMode,
} from "@/modules/exercises/sessionModes";
import {
  type GrammarExercise,
  type GrammarPracticeResult,
  buildGrammarDeck,
} from "@/modules/grammarPractice";
import { filterVocabEntriesBySections, parseStudySectionParam } from "@/modules/studySections";
import { useDisplayPreferences } from "@/providers/DisplayPreferencesProvider";
import { Button } from "@/ui/components/Button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GrammarSessionPlayer } from "./session/GrammarSessionPlayer";
import {
  SessionPlayer,
  type SessionResult,
  type SessionResultPersistence,
} from "./session/SessionPlayer";
import { SessionEvidenceFrame, useSessionEvidence } from "./session/useSessionEvidence";

const SOUND_KEY = "rewards_sound_enabled";
const SESSION_COUNT_KEY = "session_default_count";
const SESSION_MODE_KEY = "session_default_mode";
const SESSION_SHUFFLE_KEY = "session_shuffle";
const DEFINITION_PRIORITY_KEY = "definition_priority";

/**
 * Route screen: glues lesson data → the matching practice engine/player →
 * progress persistence → reward feedback.
 *
 *   - On mount, opens a practice_sessions row.
 *   - Vocab answers call progress.recordAnswer; grammar answers call
 *     progress.recordContentAnswer against grammar topic content_items.
 *     Both write learning_events + upsert item_progress via FSRS-lite.
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
  const search = useSearch({ from: "/student/profile/$studentId/session/$lessonId" });
  const lessonIdNum = Number(lessonId);
  const studentIdNum = Number(studentId);
  const selectedSections = useMemo(
    () => parseStudySectionParam(search.sections),
    [search.sections],
  );

  const [seed] = useState(() => defaultSessionSeed(lessonIdNum));
  // Pronunciation autoplay is global to the tutor's preferences; the
  // provider already hydrates from app_settings, so reads here are sync.
  const { pronunciationAutoplay } = useDisplayPreferences();

  const lessonQ = useQuery({
    queryKey: queryKeys.curriculum.lessonById(lessonIdNum),
    queryFn: () => api.curriculum.getLessonById({ id: lessonIdNum }),
    enabled: Number.isFinite(lessonIdNum) && lessonIdNum > 0,
  });

  const entriesQ = useQuery({
    queryKey: queryKeys.vocab.full(lessonIdNum),
    queryFn: () => api.vocab.listFullByLesson({ lessonId: lessonIdNum }),
    enabled: Number.isFinite(lessonIdNum) && lessonIdNum > 0 && lessonQ.data?.kind === "vocabulary",
  });

  const seenEntryIdsQ = useQuery({
    queryKey: queryKeys.progress.seenEntryIdsByLesson(studentIdNum, lessonIdNum),
    queryFn: () =>
      api.progress.seenEntryIdsByLesson({ studentId: studentIdNum, lessonId: lessonIdNum }),
    enabled:
      Number.isFinite(studentIdNum) &&
      studentIdNum > 0 &&
      Number.isFinite(lessonIdNum) &&
      lessonIdNum > 0 &&
      lessonQ.data?.kind === "vocabulary",
  });

  const grammarTopicsQ = useQuery({
    queryKey: queryKeys.grammar.practice(lessonIdNum),
    queryFn: () => api.grammar.listPracticeByLesson({ lessonId: lessonIdNum }),
    enabled: Number.isFinite(lessonIdNum) && lessonIdNum > 0 && lessonQ.data?.kind === "grammar",
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

  const definitionPriorityQ = useQuery({
    queryKey: ["settings", "get", DEFINITION_PRIORITY_KEY],
    queryFn: () => api.settings.get<string>({ key: DEFINITION_PRIORITY_KEY }),
  });

  const sessionCount = normalizeSessionCount(sessionCountQ.data);
  const sessionMode = normalizeExerciseSessionMode(sessionModeQ.data);
  const definitionPriority = normalizeDefinitionPriority(definitionPriorityQ.data);
  const effectiveSessionMode =
    lessonQ.data?.kind === "grammar" ? "grammar" : practiceModeForExerciseMode(sessionMode);
  const exerciseKinds = useMemo(() => exerciseKindsForMode(sessionMode), [sessionMode]);
  const shuffleDeck = sessionShuffleQ.data !== false;
  const settingsLoading =
    sessionCountQ.isLoading ||
    sessionModeQ.isLoading ||
    sessionShuffleQ.isLoading ||
    definitionPriorityQ.isLoading;

  const sessionStart = useMutation({
    mutationFn: (input: { studentId: number }) =>
      api.progress.startSession({ studentId: input.studentId, mode: effectiveSessionMode }),
  });

  // Open the session exactly once when student + lesson are valid.
  // Using a ref so React 18 strict-mode double-invokes don't double-open.
  const openedFor = useRef<string | null>(null);
  const sessionId = sessionStart.data?.id ?? null;
  const evidence = useSessionEvidence({
    studentId: studentIdNum,
    sessionId,
    contextLabel: lessonQ.data?.title,
  });

  useEffect(() => {
    if (lessonQ.isLoading || !lessonQ.data) return;
    if (settingsLoading) return;
    if (!Number.isFinite(studentIdNum) || studentIdNum <= 0) return;
    const key = `${studentIdNum}:${lessonIdNum}:${seed}:${effectiveSessionMode}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    sessionStart.mutate({ studentId: studentIdNum });
  }, [
    lessonQ.isLoading,
    lessonQ.data,
    settingsLoading,
    studentIdNum,
    lessonIdNum,
    seed,
    effectiveSessionMode,
    sessionStart.mutate,
  ]);

  const filteredEntries = useMemo(() => {
    if (!entriesQ.data) return [];
    return filterVocabEntriesBySections(entriesQ.data, selectedSections);
  }, [entriesQ.data, selectedSections]);

  const deck = useMemo<Exercise[]>(() => {
    if (!entriesQ.data || settingsLoading || seenEntryIdsQ.isLoading) return [];
    return buildDeck({
      entries: filteredEntries,
      kinds: exerciseKinds,
      sessionSeed: seed,
      maxExercises: sessionCount,
      definitionPriority,
      shuffle: shuffleDeck,
      seenEntryIds: seenEntryIdsQ.data ?? [],
      requireFlashcardForNew: true,
    }).exercises;
  }, [
    entriesQ.data,
    filteredEntries,
    exerciseKinds,
    seed,
    sessionCount,
    definitionPriority,
    shuffleDeck,
    seenEntryIdsQ.data,
    seenEntryIdsQ.isLoading,
    settingsLoading,
  ]);

  const grammarDeck = useMemo<GrammarExercise[]>(() => {
    if (!grammarTopicsQ.data || settingsLoading) return [];
    return buildGrammarDeck({
      topics: grammarTopicsQ.data,
      sessionSeed: seed,
      maxExercises: sessionCount,
      shuffle: shuffleDeck,
    }).exercises;
  }, [grammarTopicsQ.data, seed, sessionCount, shuffleDeck, settingsLoading]);

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
        responseMs: result.responseMs,
      });
      return { unlockedAchievements: response.unlockedAchievements };
    },
    [sessionId, studentIdNum],
  );

  const handleGrammarResult = useCallback(
    async (result: GrammarPracticeResult): Promise<SessionResultPersistence | undefined> => {
      if (sessionId === null) return undefined;
      const response = await api.progress.recordContentAnswer({
        studentId: studentIdNum,
        sessionId,
        contentItemId: result.contentItemId,
        outcome: {
          correct: result.outcome.correct,
          feedback: result.outcome.feedback,
          selfGrade: result.outcome.selfGrade,
          selectedIndex: result.outcome.selectedIndex,
        },
        currentSessionRun: result.currentSessionRun,
        responseMs: result.responseMs,
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

  const lessonKind = lessonQ.data?.kind;
  const contentLoading =
    lessonKind === "vocabulary"
      ? entriesQ.isLoading || seenEntryIdsQ.isLoading
      : lessonKind === "grammar"
        ? grammarTopicsQ.isLoading
        : false;

  if (lessonQ.isLoading || contentLoading || settingsLoading) {
    return <p className="px-6 py-10 text-sm text-muted">Loading session…</p>;
  }

  if (!lessonQ.data) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <p className="text-sm text-danger">Lesson not found.</p>
        <Button className="mt-4" variant="secondary" onClick={exit}>
          Back
        </Button>
      </div>
    );
  }

  if (lessonKind === "grammar") {
    const contextLabel = lessonQ.data
      ? `${lessonQ.data.title} · ${grammarTopicsQ.data?.length ?? 0} topics`
      : undefined;
    return (
      <SessionEvidenceFrame monitor={evidence}>
        <GrammarSessionPlayer
          topics={grammarTopicsQ.data ?? []}
          deck={grammarDeck}
          onExit={exit}
          onResult={handleGrammarResult}
          onEvidence={(result) =>
            evidence.recordAnswerEvidence({
              exerciseId: result.exerciseId,
              kind: result.kind,
              responseMs: result.responseMs,
              correct: result.outcome.correct,
              currentSessionRun: result.currentSessionRun,
            })
          }
          contextLabel={contextLabel}
          soundEnabled={soundQ.data === true}
        />
      </SessionEvidenceFrame>
    );
  }

  const contextLabel =
    lessonKind === "vocabulary" && lessonQ.data
      ? `${lessonQ.data.title} · ${filteredEntries.length}/${entriesQ.data?.length ?? 0} entries`
      : undefined;

  return (
    <SessionEvidenceFrame monitor={evidence}>
      <SessionPlayer
        deck={deck}
        onExit={exit}
        onResult={handleResult}
        onEvidence={(result) =>
          evidence.recordAnswerEvidence({
            exerciseId: result.exerciseId,
            kind: result.kind,
            responseMs: result.responseMs,
            correct: result.outcome.correct,
            currentSessionRun: result.currentSessionRun,
          })
        }
        contextLabel={contextLabel}
        soundEnabled={soundQ.data === true}
        autoplay={pronunciationAutoplay}
      />
    </SessionEvidenceFrame>
  );
}

function normalizeSessionCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 15;
  return Math.min(30, Math.max(5, Math.round(value)));
}

function normalizeDefinitionPriority(value: unknown): "en_first" | "vi_first" {
  return value === "vi_first" ? "vi_first" : "en_first";
}
