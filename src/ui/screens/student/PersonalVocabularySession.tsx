import type { DictionaryLearningItemView } from "@/data/dictionaryLearning";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import {
  createLazyDeck,
  defaultSessionSeed,
  fromDictionaryItem,
  getPlugin,
} from "@/modules/exercises";
import {
  exerciseKindsForMode,
  normalizeExerciseSessionMode,
  practiceModeForExerciseMode,
} from "@/modules/exercises/sessionModes";
import { useDisplayPreferences } from "@/providers/DisplayPreferencesProvider";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type SessionDeck,
  SessionPlayer,
  type SessionResult,
  type SessionResultPersistence,
} from "./session/SessionPlayer";

const SOUND_KEY = "rewards_sound_enabled";
const SESSION_COUNT_KEY = "session_default_count";
const SESSION_MODE_KEY = "session_default_mode";
const SESSION_SHUFFLE_KEY = "session_shuffle";
const DEFINITION_PRIORITY_KEY = "definition_priority";

export function StudentPersonalVocabularySession() {
  const { studentId } = useParams({
    from: "/student/profile/$studentId/personal-vocabulary/session",
  });
  const studentIdNum = Number(studentId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [seed] = useState(() => defaultSessionSeed(0));
  const { pronunciationAutoplay, pronunciationAccent } = useDisplayPreferences();

  const queueQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.practiceQueue(studentIdNum, 12),
    queryFn: () => api.dictionaryLearning.practiceQueue({ studentId: studentIdNum, limit: 12 }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const itemsQ = useQuery({
    queryKey: queryKeys.dictionaryLearning.items(studentIdNum),
    queryFn: () => api.dictionaryLearning.listItems({ studentId: studentIdNum }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(studentIdNum),
    queryFn: () => api.students.getById({ id: studentIdNum }),
    enabled: Number.isFinite(studentIdNum) && studentIdNum > 0,
  });

  const settingsQ = useQuery({
    queryKey: ["settings", "personalVocabularySession"],
    queryFn: () => api.settings.getAll(),
    staleTime: 0,
  });

  const settings = settingsQ.data ?? {};
  const sessionCount = normalizeSessionCount(settings[SESSION_COUNT_KEY]);
  const sessionMode = normalizeExerciseSessionMode(settings[SESSION_MODE_KEY]);
  const exerciseKinds = useMemo(() => exerciseKindsForMode(sessionMode), [sessionMode]);
  const definitionPriority = normalizeDefinitionPriority(settings[DEFINITION_PRIORITY_KEY]);
  const shuffleDeck = settings[SESSION_SHUFFLE_KEY] !== false;
  const settingsLoading = settingsQ.isLoading;

  const sessionStart = useMutation({
    mutationFn: (input: { studentId: number }) =>
      api.progress.startSession({
        studentId: input.studentId,
        mode: practiceModeForExerciseMode(sessionMode),
      }),
  });

  const openedFor = useRef<string | null>(null);
  const sessionId = sessionStart.data?.id ?? null;
  const queue = queueQ.data ?? [];
  const allItems = itemsQ.data?.length ? itemsQ.data : queue;

  const sourcePool = useMemo(() => allItems.map(fromDictionaryItem), [allItems]);
  const sourceByItemId = useMemo(() => {
    const map = new Map<number, DictionaryLearningItemView>();
    for (const item of allItems) map.set(item.id, item);
    return map;
  }, [allItems]);
  const seenSourceKeys = useMemo(
    () =>
      sourcePool
        .filter((source) => (sourceByItemId.get(source.id)?.reps ?? 0) > 0)
        .map((s) => s.ref.sourceKey),
    [sourceByItemId, sourcePool],
  );

  const deck = useMemo<SessionDeck>(() => {
    if (settingsLoading || queueQ.isLoading || itemsQ.isLoading) return [];
    return createLazyDeck({
      sources: queue.map(fromDictionaryItem),
      sourcePool,
      kinds: exerciseKinds,
      sessionSeed: seed,
      getPlugin,
      maxExercises: sessionCount,
      definitionPriority,
      shuffle: shuffleDeck,
      seenSourceKeys,
      requireFlashcardForNew: true,
    });
  }, [
    definitionPriority,
    exerciseKinds,
    itemsQ.isLoading,
    queue,
    queueQ.isLoading,
    seed,
    seenSourceKeys,
    sessionCount,
    settingsLoading,
    shuffleDeck,
    sourcePool,
  ]);

  useEffect(() => {
    if (queueQ.isLoading || settingsLoading) return;
    if (queue.length === 0) return;
    if (!Number.isFinite(studentIdNum) || studentIdNum <= 0) return;
    const key = `${studentIdNum}:personal-vocabulary:${seed}:${sessionMode}`;
    if (openedFor.current === key) return;
    openedFor.current = key;
    sessionStart.mutate({ studentId: studentIdNum });
  }, [
    queue.length,
    queueQ.isLoading,
    seed,
    sessionMode,
    sessionStart.mutate,
    settingsLoading,
    studentIdNum,
  ]);

  const exit = useCallback(() => {
    if (sessionId !== null) {
      void api.progress
        .endSession({ sessionId })
        .catch((error) => console.error("[PersonalVocabularySession] endSession failed", error))
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ["dictionaryLearning"] });
          queryClient.invalidateQueries({ queryKey: ["progress"] });
        });
    }
    void navigate({
      to: "/student/profile/$studentId/personal-vocabulary",
      params: { studentId: String(studentIdNum) },
    });
  }, [navigate, queryClient, sessionId, studentIdNum]);

  const handleResult = useCallback(
    async (result: SessionResult): Promise<SessionResultPersistence | undefined> => {
      if (sessionId === null) return undefined;
      const itemId = result.source.dictionaryItemId ?? result.entryId;
      const item = sourceByItemId.get(itemId);
      if (!item) return undefined;

      const response = await api.dictionaryLearning.recordReview({
        studentId: studentIdNum,
        itemId,
        stage: item.stage,
        correct: result.outcome.correct,
        selfGrade: result.outcome.selfGrade,
        answer: result.kind,
        expected: item.headword,
        sessionId,
      });

      queryClient.setQueryData(
        queryKeys.dictionaryLearning.items(studentIdNum),
        (old: DictionaryLearningItemView[] | undefined) =>
          old?.map((candidate) => (candidate.id === response.item.id ? response.item : candidate)),
      );
      void queryClient.invalidateQueries({ queryKey: ["dictionaryLearning"] });
      void queryClient.invalidateQueries({ queryKey: ["progress"] });
      return { unlockedAchievements: [] };
    },
    [queryClient, sessionId, sourceByItemId, studentIdNum],
  );

  if (!Number.isFinite(studentIdNum) || studentIdNum <= 0) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <p className="text-sm text-danger">Invalid student.</p>
      </div>
    );
  }

  if (queueQ.isLoading || itemsQ.isLoading || settingsLoading) {
    return <p className="px-6 py-10 text-sm text-muted">Loading personal review...</p>;
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10">
        <Button variant="ghost" className="self-start text-muted" onClick={exit}>
          Back
        </Button>
        <EmptyState
          title="No personal words due"
          body="Search dictionary entries from the student header to add new personal flashcards."
        />
      </div>
    );
  }

  return (
    <SessionPlayer
      deck={deck}
      onExit={exit}
      onResult={handleResult}
      contextLabel={`Personal vocabulary · ${queue.length}/${allItems.length} due words`}
      soundEnabled={settings[SOUND_KEY] === true}
      autoplay={pronunciationAutoplay}
      preferredAccent={pronunciationAccent}
      avatarSeed={studentQ.data?.avatarSeed ?? null}
      studentId={studentIdNum}
    />
  );
}

function normalizeSessionCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 15;
  return Math.min(30, Math.max(5, Math.round(value)));
}

function normalizeDefinitionPriority(value: unknown): "en_first" | "vi_first" {
  return value === "vi_first" ? "vi_first" : "en_first";
}
