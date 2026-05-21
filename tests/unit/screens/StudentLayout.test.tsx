import { AppModeProvider } from "@/providers/AppModeProvider";
import { StudentLayout } from "@/ui/shell/StudentLayout";
import { clearUnlockedStudentProfiles, markStudentUnlocked } from "@/ui/student/access";
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

function renderStudentLayout() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const studentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "student",
    component: StudentLayout,
  });
  const sessionRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId/session/$lessonId",
    component: () => <div data-testid="study-child" className="w-full" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([studentRoute.addChildren([sessionRoute])]),
    history: createMemoryHistory({ initialEntries: ["/student/profile/1/session/2"] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <AppModeProvider initialMode="student" initialHasPin>
        <RouterProvider router={router} />
      </AppModeProvider>
    </QueryClientProvider>,
  );
}

describe("StudentLayout", () => {
  beforeEach(() => {
    clearUnlockedStudentProfiles();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets routed study screens own the full horizontal surface", async () => {
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(false);
    renderStudentLayout();

    const main = await screen.findByRole("main");
    expect(main).toHaveClass("min-w-0", "flex-1", "overflow-y-auto");
    expect(main).not.toHaveClass("flex");
    await waitFor(() => expect(screen.getByTestId("study-child")).toBeInTheDocument());
  });

  it("tints uploaded study background images behind the student surface", async () => {
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(false);
    vi.spyOn(window.api.settings, "get").mockResolvedValue(
      'url("data:image/png;base64,abc") center / cover no-repeat',
    );
    renderStudentLayout();

    expect(await screen.findByTestId("student-background-tint")).toHaveClass(
      "backdrop-brightness-75",
      "backdrop-saturate-75",
    );
    expect(await screen.findByRole("main")).toHaveClass("relative", "z-10", "bg-transparent");
  });

  it("keeps preset gradient study backgrounds untinted", async () => {
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(false);
    vi.spyOn(window.api.settings, "get").mockResolvedValue("linear-gradient(135deg,#fff,#eef)");
    renderStudentLayout();

    await waitFor(() => expect(screen.getByRole("main")).toHaveClass("bg-transparent"));
    expect(screen.queryByTestId("student-background-tint")).toBeNull();
  });

  it("blocks deep links to protected profiles until the profile is unlocked", async () => {
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(true);
    renderStudentLayout();

    expect(await screen.findByText("Profile locked")).toBeInTheDocument();
    expect(screen.queryByTestId("study-child")).toBeNull();
    expect(screen.getByRole("link", { name: /choose profile/i })).toHaveAttribute(
      "href",
      "/student",
    );
  });

  it("allows protected profile routes after the picker unlocks the student", async () => {
    markStudentUnlocked(1);
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(true);
    renderStudentLayout();

    expect(await screen.findByTestId("study-child")).toBeInTheDocument();
    expect(screen.queryByText("Profile locked")).toBeNull();
  });
});
