import type { Book, Student, Unit } from "@/data/types";
import { StudentHome, selectRecommendedUnitId } from "@/ui/screens/student/Home";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ProgressRow = Awaited<ReturnType<Window["api"]["progress"]["assignedUnitProgress"]>>[number];

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

function unit(overrides: Partial<Unit> = {}): Unit {
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
    ...overrides,
  };
}

function progressRow(overrides: Partial<ProgressRow> = {}): ProgressRow {
  return {
    bookId: 1,
    unitId: 10,
    totalCount: 0,
    introducedCount: 0,
    newCount: 0,
    learningCount: 0,
    secureCount: 0,
    dueCount: 0,
    currentCount: 0,
    dueLearningCount: 0,
    dueSecureCount: 0,
    learningCurrentCount: 0,
    secureCurrentCount: 0,
    oldestDueAt: null,
    lessons: [],
    ...overrides,
  };
}

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
  const linkedRoutes = [
    "profile/$studentId/unit/$unitId",
    "profile/$studentId/achievements",
    "profile/$studentId/personal-vocabulary",
    "profile/$studentId/pronunciation",
  ].map((path) =>
    createRoute({
      getParentRoute: () => studentRoute,
      path,
      component: () => null,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([studentRoute.addChildren([profileRoute, ...linkedRoutes])]),
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
    vi.spyOn(window.api.progress, "assignedUnitProgress").mockResolvedValue([progressRow()]);
    vi.spyOn(window.api.progress, "studentSummary").mockResolvedValue({
      totalSeen: 0,
      totalCorrect: 0,
      totalWrong: 0,
      accuracy: 0,
      totalDue: 0,
    });
    vi.spyOn(window.api.progress, "dueByLesson");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses an open curriculum layout, a stronger identity header, and one batch progress read", async () => {
    renderHome();

    const studentName = await screen.findByRole("heading", { level: 1, name: "Alice" });
    expect(studentName).toHaveClass("font-display", "text-[30px]");
    expect(studentName.closest("header")?.querySelector("[aria-hidden='true']")).toHaveClass(
      "h-16",
      "w-16",
    );
    expect(await screen.findByText("Destination B1")).toBeInTheDocument();
    expect(screen.queryByText("destination-b1")).not.toBeInTheDocument();

    const unitList = await screen.findByTestId("book-unit-list");
    expect(unitList).toHaveClass("student-unit-grid");
    expect(unitList).not.toHaveClass("ui-group", "grouped-list");
    expect(screen.getByTestId("unit-learning-object")).not.toHaveClass("learning-trace");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /People/ })).toHaveAttribute(
      "href",
      "/student/profile/1/unit/10",
    );
    expect(window.api.progress.assignedUnitProgress).toHaveBeenCalledTimes(1);
    expect(window.api.progress.dueByLesson).not.toHaveBeenCalled();
  });

  it("shows four disjoint item states and truthful lifetime statistics", async () => {
    vi.mocked(window.api.progress.assignedUnitProgress).mockResolvedValue([
      progressRow({
        totalCount: 10,
        introducedCount: 7,
        newCount: 3,
        learningCount: 4,
        secureCount: 3,
        dueCount: 2,
        currentCount: 5,
        dueLearningCount: 1,
        dueSecureCount: 1,
        learningCurrentCount: 3,
        secureCurrentCount: 2,
        oldestDueAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ]);
    vi.mocked(window.api.progress.studentSummary).mockResolvedValue({
      totalSeen: 7,
      totalCorrect: 4,
      totalWrong: 1,
      accuracy: 0.12,
      totalDue: 2,
    });

    renderHome();

    const track = await screen.findByRole("img", {
      name: /2 review now.*3 learning and current.*2 secure and current.*3 new.*10 items total/i,
    });
    expect(within(track).getByText("Review now")).toBeInTheDocument();
    expect(within(track).getByText("Learning · current")).toBeInTheDocument();
    expect(within(track).getByText("Secure · current")).toBeInTheDocument();
    expect(within(track).getByText("New")).toBeInTheDocument();
    expect(
      within(track).getByText(/Review mix: 1 learning · 1 previously secure/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    const record = screen.getByRole("complementary", { name: "Learning progress" });
    expect(within(record).getByText("Items practiced").parentElement).toHaveTextContent(
      /7.*Distinct items across all practice/,
    );
    expect(within(record).getByText("Lifetime accuracy").parentElement).toHaveTextContent(
      /80%.*4 correct from 5 answers/,
    );
    expect(within(record).queryByText("Words seen")).not.toBeInTheDocument();
    expect(within(record).queryByText("Streak")).not.toBeInTheDocument();
    expect(within(record).queryByText("Due")).not.toBeInTheDocument();
  });

  it("marks exactly one review action, treating unscheduled due items as most urgent", async () => {
    vi.mocked(window.api.students.listAssignedUnits).mockResolvedValue([
      unit(),
      unit({ id: 11, ordinal: 2, code: "U02", title: "Work" }),
      unit({ id: 12, ordinal: 3, code: "U03", title: "Travel" }),
    ]);
    vi.mocked(window.api.progress.assignedUnitProgress).mockResolvedValue([
      progressRow({ unitId: 10, totalCount: 20, dueCount: 1, oldestDueAt: null }),
      progressRow({
        unitId: 11,
        totalCount: 10,
        dueCount: 9,
        oldestDueAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      progressRow({
        unitId: 12,
        totalCount: 10,
        dueCount: 5,
        oldestDueAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
    ]);

    renderHome();

    await screen.findByRole("link", { name: /Travel/i });
    const reviewActions = screen.getAllByTestId("review-now-action");
    expect(reviewActions).toHaveLength(1);
    const recommendedLink = reviewActions[0]?.closest("a");
    expect(recommendedLink).toHaveAttribute("data-recommended", "true");
    expect(recommendedLink).toHaveTextContent("People");
  });

  it("uses due ratio, due count, then curriculum order as recommendation tie-breaks", () => {
    const units = [
      { unit: unit(), order: 0 },
      { unit: unit({ id: 11, ordinal: 2, code: "U02", title: "Work" }), order: 1 },
    ];
    const sameOldest = new Date("2026-01-01T00:00:00.000Z");

    expect(
      selectRecommendedUnitId(
        [
          progressRow({ unitId: 10, totalCount: 10, dueCount: 2, oldestDueAt: null }),
          progressRow({ unitId: 11, totalCount: 2, dueCount: 1, oldestDueAt: null }),
        ],
        units,
      ),
    ).toBe(11);
    expect(
      selectRecommendedUnitId(
        [
          progressRow({ unitId: 10, totalCount: 2, dueCount: 1, oldestDueAt: sameOldest }),
          progressRow({ unitId: 11, totalCount: 6, dueCount: 3, oldestDueAt: sameOldest }),
        ],
        units,
      ),
    ).toBe(11);
    expect(
      selectRecommendedUnitId(
        [
          progressRow({ unitId: 10, totalCount: 4, dueCount: 2, oldestDueAt: sameOldest }),
          progressRow({ unitId: 11, totalCount: 4, dueCount: 2, oldestDueAt: sameOldest }),
        ],
        units,
      ),
    ).toBe(10);
  });

  it("opens achievement glyph details in an accessible dialog and keeps See all", async () => {
    const unlockedAt = new Date("2026-07-14T00:00:00.000Z");
    vi.spyOn(window.api.rewards, "stats").mockResolvedValue({
      totalCorrect: 1,
      distinctCorrect: 1,
      totalAttempts: 1,
      currentStreak: 0,
      bestSessionRun: 0,
    });
    vi.spyOn(window.api.rewards, "listUnlocked").mockResolvedValue([
      { studentId: 1, achievementId: "first_answer", unlockedAt },
    ]);

    renderHome();

    const glyph = await screen.findByRole("button", { name: "View achievement: Spark Rookie" });
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/student/profile/1/achievements",
    );
    glyph.focus();
    fireEvent.click(glyph);

    const dialog = await screen.findByRole("dialog", { name: "Spark Rookie" });
    expect(dialog).toHaveTextContent("Answered your very first question correctly.");
    expect(dialog).toHaveTextContent("Tier Bronze");
    expect(dialog).toHaveTextContent("Collected");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(glyph).toHaveFocus();
  });

  it("does not replace an unavailable saved-word total with a false zero", async () => {
    vi.spyOn(window.api.dictionaryLearning, "summary").mockRejectedValue(new Error("offline"));
    renderHome();

    expect(await screen.findByText("Saved-word totals unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/^0 saved/)).not.toBeInTheDocument();
  });

  it("shows one retryable progress alert while keeping every unit navigable", async () => {
    vi.mocked(window.api.students.listAssignedUnits).mockResolvedValue([
      unit(),
      unit({ id: 11, ordinal: 2, code: "U02", title: "Work" }),
    ]);
    vi.mocked(window.api.progress.assignedUnitProgress)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([
        progressRow({ totalCount: 1, newCount: 1 }),
        progressRow({ unitId: 11, totalCount: 1, newCount: 1 }),
      ]);

    renderHome();

    const retry = await screen.findByRole("button", { name: "Retry status" });
    expect(screen.getAllByText(/Item status is temporarily unavailable/)).toHaveLength(1);
    expect(screen.queryByText("Progress is temporarily unavailable.")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /People/i })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Work/i })).toBeInTheDocument();

    fireEvent.click(retry);
    await waitFor(() => expect(window.api.progress.assignedUnitProgress).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText(/Item status is temporarily unavailable/)).not.toBeInTheDocument(),
    );
  });

  it("renders the empty assignment state when no books are assigned", async () => {
    vi.mocked(window.api.students.listAssignedBooks).mockResolvedValue([]);
    renderHome();
    expect(await screen.findByText(/No assigned units yet/i)).toBeInTheDocument();
  });

  it("does not mount learning queries or controls for a missing profile", async () => {
    vi.mocked(window.api.students.getById).mockResolvedValue(null);

    renderHome();

    expect(
      await screen.findByRole("heading", { name: "Learner profile not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose profile" })).toHaveAttribute(
      "href",
      "/student",
    );
    expect(window.api.students.listAssignedBooks).not.toHaveBeenCalled();
    expect(window.api.progress.assignedUnitProgress).not.toHaveBeenCalled();
  });
});
