import type { Book, Lesson, Student, Unit } from "@/data/types";
import { StudentHome } from "@/ui/screens/student/Home";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const epoch = new Date(0);

function student(): Student {
  return {
    id: 1,
    name: "Alice",
    displayName: null,
    avatarSeed: null,
    color: null,
    pinHash: null,
    notes: null,
    archivedAt: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function book(): Book {
  return {
    id: 1,
    code: "destination-b1",
    title: "Destination B1",
    level: null,
    publisher: null,
    language: "en",
    metadata: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function unit(): Unit {
  return {
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
}

function lesson(): Lesson {
  return {
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
}

function grammarLesson(): Lesson {
  return {
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
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Tiny memory router that mirrors the production tree shape so
  // `useParams({ from: "/student/profile/$studentId" })` resolves.
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const studentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "student",
    component: () => <Outlet />,
  });
  const profileRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId",
    component: StudentHome,
  });
  const unitRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId/unit/$unitId",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([studentRoute.addChildren([profileRoute, unitRoute])]),
    history: createMemoryHistory({ initialEntries: ["/student/profile/1"] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("StudentHome", () => {
  beforeEach(() => {
    vi.spyOn(window.api.students, "getById").mockResolvedValue(student());
    vi.spyOn(window.api.students, "listAssignedBooks").mockResolvedValue([book()]);
    vi.spyOn(window.api.students, "listAssignedUnits").mockResolvedValue([unit()]);
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([lesson()]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the student name and assigned unit, with an empty-content state", async () => {
    vi.spyOn(window.api.progress, "dueByLesson").mockResolvedValue({
      totalCount: 0,
      dueCount: 0,
      newCount: 0,
    });
    vi.spyOn(window.api.progress, "studentSummary").mockResolvedValue({
      totalSeen: 0,
      totalCorrect: 0,
      totalWrong: 0,
      accuracy: 0,
      totalDue: 0,
    });
    renderHome();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Destination B1")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No cards yet/i)).toBeInTheDocument());
  });

  it("renders due / new badges when the assigned unit has progress", async () => {
    vi.spyOn(window.api.progress, "dueByLesson").mockResolvedValue({
      totalCount: 5,
      dueCount: 2,
      newCount: 1,
    });
    vi.spyOn(window.api.progress, "studentSummary").mockResolvedValue({
      totalSeen: 3,
      totalCorrect: 4,
      totalWrong: 1,
      accuracy: 0.8,
      totalDue: 2,
    });
    renderHome();
    await waitFor(() => expect(screen.getByText(/U01: People/)).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /People/ });
    expect(within(link).getByText(/2 due/i)).toBeInTheDocument();
    expect(within(link).getByText(/1 new/i)).toBeInTheDocument();
    // Header summary stats.
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("surfaces grammar availability on the assigned unit card", async () => {
    vi.spyOn(window.api.curriculum, "listLessonsByUnit").mockResolvedValue([
      lesson(),
      grammarLesson(),
    ]);
    vi.spyOn(window.api.progress, "dueByLesson").mockImplementation(async ({ lessonId }) =>
      lessonId === 101
        ? { totalCount: 3, dueCount: 0, newCount: 3 }
        : { totalCount: 5, dueCount: 1, newCount: 0 },
    );
    vi.spyOn(window.api.progress, "studentSummary").mockResolvedValue({
      totalSeen: 3,
      totalCorrect: 4,
      totalWrong: 1,
      accuracy: 0.8,
      totalDue: 1,
    });

    renderHome();

    await waitFor(() => expect(screen.getByText(/U01: People/)).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /People/ });
    expect(within(link).getByText(/Grammar/i)).toBeInTheDocument();
    expect(within(link).getByText(/3 new/i)).toBeInTheDocument();
    expect(within(link).getByText(/8 items/i)).toBeInTheDocument();
  });

  it("renders the empty assignment state when no books are assigned", async () => {
    vi.spyOn(window.api.students, "listAssignedBooks").mockResolvedValue([]);
    renderHome();
    await waitFor(() => expect(screen.getByText(/No assigned units yet/i)).toBeInTheDocument());
  });
});
