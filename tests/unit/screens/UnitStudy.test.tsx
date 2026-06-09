import type { Lesson, Unit, VocabEntry } from "@/data/types";
import { StudentUnitStudy } from "@/ui/screens/student/UnitStudy";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function vocabEntry(overrides: Partial<VocabEntry>): VocabEntry {
  return {
    id: 1,
    lessonId: 100,
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
    ...overrides,
  };
}

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
    validateSearch: (raw: Record<string, unknown>) => {
      const out: { sections?: string; skipSpeaking?: boolean } = {};
      if (typeof raw.sections === "string") out.sections = raw.sections;
      if (raw.skipSpeaking === true || raw.skipSpeaking === "true") out.skipSpeaking = true;
      return out;
    },
    component: SessionProbe,
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

function SessionProbe() {
  const search = useRouterState({ select: (state) => state.location.search });
  return <div data-testid="session-route">{JSON.stringify(search)}</div>;
}

describe("StudentUnitStudy", () => {
  beforeEach(() => {
    vi.spyOn(window.api.curriculum, "getUnitById").mockResolvedValue(unit);
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([vocabLesson]);
    vi.spyOn(window.api.vocab, "listByLesson").mockResolvedValue([
      vocabEntry({ id: 1, pos: "noun", headword: "relative" }),
      vocabEntry({
        id: 2,
        sourceId: "give-up",
        headword: "give up",
        pos: "phrasal_verb",
        tags: ["phrasal-verb"],
      }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps vocabulary-only units on the section picker before starting a session", async () => {
    renderUnitStudy();

    await waitFor(() => expect(screen.getByText(/Study plan/i)).toBeInTheDocument());
    expect(screen.queryByTestId("session-route")).toBeNull();
    expect(window.api.vocab.listByLesson).toHaveBeenCalledWith({ lessonId: vocabLesson.id });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Vocabulary/i })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(await screen.findByRole("button", { name: /Phrasal verbs/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("starts vocab sessions with the selected section filter", async () => {
    renderUnitStudy();

    const vocabularySection = await screen.findByRole("button", { name: /Vocabulary/i });
    await waitFor(() => expect(vocabularySection).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(vocabularySection);
    fireEvent.click(screen.getByRole("button", { name: /Start 1 cards/i }));

    await waitFor(() => expect(screen.getByTestId("session-route")).toBeInTheDocument());
    expect(screen.getByTestId("session-route")).toHaveTextContent('"sections":"phrasal_verbs"');
  });

  it("passes the per-unit skip-speaking choice into the vocab session", async () => {
    renderUnitStudy();

    const toggle = await screen.findByRole("checkbox", { name: /skip speaking/i });
    fireEvent.click(toggle);
    fireEvent.click(await screen.findByRole("button", { name: /Start 2 cards/i }));

    await waitFor(() => expect(screen.getByTestId("session-route")).toBeInTheDocument());
    expect(screen.getByTestId("session-route")).toHaveTextContent('"skipSpeaking":true');
  });

  it("keeps the unit study layer when a unit has grammar", async () => {
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([
      vocabLesson,
      grammarLesson,
    ]);

    renderUnitStudy();

    await waitFor(() => expect(screen.getByText(/Study plan/i)).toBeInTheDocument());
    expect(screen.getByText(/Start grammar/i)).toBeInTheDocument();
    expect(window.api.vocab.listByLesson).toHaveBeenCalledWith({ lessonId: vocabLesson.id });
  });
});
