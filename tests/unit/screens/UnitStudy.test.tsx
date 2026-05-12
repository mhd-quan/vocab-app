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
    vi.spyOn(window.api.vocab, "listByLesson").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects vocabulary-only units straight to the vocab session", async () => {
    renderUnitStudy();

    await screen.findByTestId("session-route");

    expect(screen.queryByText(/Study plan/i)).not.toBeInTheDocument();
    expect(window.api.vocab.listByLesson).not.toHaveBeenCalled();
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
