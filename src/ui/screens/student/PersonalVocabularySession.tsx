import { useNavigate, useParams } from "@tanstack/react-router";
import { DictionaryLearningSession } from "./session/DictionaryLearningSession";

export function StudentPersonalVocabularySession() {
  const { studentId } = useParams({
    from: "/student/profile/$studentId/personal-vocabulary/session",
  });
  const studentIdNum = Number(studentId);
  const navigate = useNavigate();

  return (
    <DictionaryLearningSession
      studentId={studentIdNum}
      scope={{ type: "personal" }}
      labels={{
        badge: "Personal review",
        loading: "Loading personal review...",
        emptyTitle: "No personal words due",
        emptyBody:
          "Search dictionary entries from the student header to add new personal flashcards.",
        doneTitle: "Personal review finished",
        exit: "End session",
      }}
      onExit={() => {
        void navigate({
          to: "/student/profile/$studentId/personal-vocabulary",
          params: { studentId: String(studentIdNum) },
        });
      }}
    />
  );
}
