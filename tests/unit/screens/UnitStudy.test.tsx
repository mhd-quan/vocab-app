import type { Lesson, Unit } from "@/data/types";
import { StudentUnitStudy } from "@/ui/screens/student/UnitStudy";
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

const unit: Unit = {
  id: 10,
  bookId: 1,
  ordinal: 1,
  code: "U01",
  title: "People",
  summaryMd: null,
  metadata: null,
  createdAt: epoch,
  updatedAt: epoch,
};

const vocabLesson: Lesson = {
  id: 100,
  unitId: 10,
  ordinal: 1,
  kind: "vocabulary",
  title: "Family",
  slug: "family",
  metadata: null,
  createdAt: epoch,
  updatedAt: epoch,
};

const grammarLesson: Lesson = {
  id: 101,
  unitId: 10,
  ordinal: 2,
  kind: "grammar",
  title: "Present simple",
  slug: "present-simple",
  metadata: null,
  createdAt: epoch,
  updatedAt: epoch,
};

const vocabEntry: VocabEntryFull = {
  id: 1,
  lessonId: vocabLesson.id,
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

function renderUnitStudy() {
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
  const unitRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId/unit/$unitId",
    component: StudentUnitStudy,
  });
  const sessionRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId/session/$lessonId",
    component: () => <div data-testid="session-route" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      studentRoute.addChildren([profileRoute, unitRoute, sessionRoute]),
    ]),
    history: createMemoryHistory({ initialEntries: ["/student/profile/1/unit/10"] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("StudentUnitStudy", () => {
  beforeEach(() => {
    vi.spyOn(window.api.curriculum, "getUnitById").mockResolvedValue(unit);
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([vocabLesson]);
    vi.spyOn(window.api.vocab, "listFullByLesson").mockResolvedValue([vocabEntry]);
    vi.spyOn(window.api.dictionaryLearning, "prepareUnitLesson").mockResolvedValue({
      total: 1,
      inserted: 1,
      updated: 0,
    });
    vi.spyOn(window.api.dictionaryLearning, "lessonSummary").mockResolvedValue({
      total: 1,
      due: 1,
      new: 0,
      learning: 1,
      shortTerm: 0,
      longTerm: 0,
      averageScore: 0,
    });
    vi.spyOn(window.api.dictionaryLearning, "lessonItems").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the unit vocabulary SRS layer for vocabulary-only units", async () => {
    renderUnitStudy();

    await screen.findByText(/Vocabulary SRS/i);

    expect(screen.getByText(/Start unit review/i)).toBeInTheDocument();
    expect(await screen.findByText("relative")).toBeInTheDocument();
    expect(window.api.dictionaryLearning.prepareUnitLesson).toHaveBeenCalledWith({
      studentId: 1,
      lessonId: vocabLesson.id,
    });
  });

  it("keeps the unit study layer when a unit has grammar", async () => {
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([
      vocabLesson,
      grammarLesson,
    ]);

    renderUnitStudy();

    await waitFor(() => expect(screen.getByText(/Study plan/i)).toBeInTheDocument());
    expect(screen.getByText(/Start grammar/i)).toBeInTheDocument();
    expect(window.api.vocab.listFullByLesson).toHaveBeenCalledWith({ lessonId: vocabLesson.id });
  });
});
