import type { DictionaryLearningItemView } from "@/data/dictionaryLearning";
import type { Lesson } from "@/data/types";
import { queryKeys } from "@/lib/queryClient";
import { StudentSession } from "@/ui/screens/student/Session";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabEntryFull } from "../../../electron/db/repositories/vocab";

const epoch = new Date(0);

const vocabLesson: Lesson = {
  id: 1,
  unitId: 1,
  ordinal: 1,
  kind: "vocabulary",
  title: "Family & Friends",
  slug: "family-friends",
  metadata: null,
  createdAt: epoch,
  updatedAt: epoch,
};

const entry: VocabEntryFull = {
  id: 1,
  lessonId: 1,
  sourceId: "relative-noun",
  headword: "relative",
  lemma: null,
  pos: "noun",
  ipa: null,
  cefrLevel: "B1",
  frequencyRank: null,
  imageRef: null,
  audioRef: null,
  tags: null,
  metadata: null,
  contentHash: "h",
  createdAt: epoch,
  updatedAt: epoch,
  senses: [
    {
      id: 1,
      entryId: 1,
      ordinal: 0,
      definitionEn: "a member of your family",
      definitionVi: "người thân",
      register: "neutral",
      domain: null,
      notesMd: null,
    },
  ],
  examples: [],
  forms: [],
  collocations: [],
  relations: [],
};

const learningItem: DictionaryLearningItemView = {
  id: 10,
  studentId: 1,
  dictionaryKey: "unit:vocab:1",
  headword: "relative",
  pos: "noun",
  ipa: null,
  cefrLevel: "B1",
  definitionEn: "a member of your family",
  definitionVi: "người thân",
  exampleText: null,
  exampleTranslation: null,
  audioRef: null,
  audioRefs: [],
  status: "learning",
  stage: "flashcard",
  correctInCycle: 0,
  shortTermCorrect: 0,
  totalCorrect: 0,
  totalWrong: 0,
  score: 0,
  lastReviewedAt: null,
  nextDueAt: epoch,
  updatedAt: epoch,
};

function renderSession(client?: QueryClient) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const studentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "student",
    component: () => <Outlet />,
  });
  const profileRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId",
    component: () => null,
  });
  const sessionRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId/session/$lessonId",
    component: StudentSession,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([studentRoute.addChildren([profileRoute, sessionRoute])]),
    history: createMemoryHistory({ initialEntries: ["/student/profile/1/session/1"] }),
  });
  const queryClient =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("StudentSession", () => {
  beforeEach(() => {
    vi.spyOn(window.api.curriculum, "getLessonById").mockResolvedValue(vocabLesson);
    vi.spyOn(window.api.vocab, "listFullByLesson").mockResolvedValue([entry]);
    vi.spyOn(window.api.progress, "seenEntryIdsByLesson").mockResolvedValue([]);
    vi.spyOn(window.api.dictionaryLearning, "prepareUnitLesson").mockResolvedValue({
      total: 1,
      inserted: 1,
      updated: 0,
    });
    vi.spyOn(window.api.dictionaryLearning, "lessonPracticeQueue").mockResolvedValue([
      learningItem,
    ]);
    vi.spyOn(window.api.dictionaryLearning, "lessonItems").mockResolvedValue([learningItem]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not confuse cached unit lesson lists with lesson-by-id session data", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    client.setQueryData(queryKeys.curriculum.lessons(1), [vocabLesson]);

    renderSession(client);

    await waitFor(() =>
      expect(window.api.curriculum.getLessonById).toHaveBeenCalledWith({ id: 1 }),
    );
    await waitFor(() =>
      expect(window.api.vocab.listFullByLesson).toHaveBeenCalledWith({ lessonId: 1 }),
    );
    await waitFor(() =>
      expect(window.api.dictionaryLearning.prepareUnitLesson).toHaveBeenCalledWith({
        studentId: 1,
        lessonId: 1,
      }),
    );
    expect(await screen.findByText("relative")).toBeInTheDocument();
    expect(screen.queryByText(/No exercises in this deck/i)).not.toBeInTheDocument();
  });
});
