import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { type Exercise, buildDeck, defaultSessionSeed } from "@/modules/exercises";
import { Button } from "@/ui/components/Button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SessionPlayer } from "./session/SessionPlayer";

/**
 * Route screen: glues lesson data → exercise engine → SessionPlayer.
 * The deck is built once per (lesson, seed) pair so re-renders don't
 * reshuffle out from under the player.
 */
export function StudentSession() {
  const { studentId, lessonId } = useParams({
    from: "/student/profile/$studentId/session/$lessonId",
  });
  const navigate = useNavigate();
  const lessonIdNum = Number(lessonId);
  const studentIdNum = Number(studentId);

  // One seed per mount = a fresh deck on each "Start practice" click.
  // Re-deriving via useState (lazy initializer) keeps it stable for the
  // lifetime of the component without writing to a ref.
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

  const deck = useMemo<Exercise[]>(() => {
    if (!entriesQ.data) return [];
    return buildDeck({
      entries: entriesQ.data,
      kinds: ["flashcard", "multiple_choice"],
      sessionSeed: seed,
    }).exercises;
  }, [entriesQ.data, seed]);

  function exit() {
    void navigate({
      to: "/student/profile/$studentId",
      params: { studentId: String(studentIdNum) },
    });
  }

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

  return <SessionPlayer deck={deck} onExit={exit} contextLabel={contextLabel} />;
}
