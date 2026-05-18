import { AppModeProvider } from "@/providers/AppModeProvider";
import { StudentLayout } from "@/ui/shell/StudentLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
  it("lets routed study screens own the full horizontal surface", async () => {
    renderStudentLayout();

    const main = await screen.findByRole("main");
    expect(main).toHaveClass("min-w-0", "flex-1", "overflow-y-auto");
    expect(main).not.toHaveClass("flex");
    expect(screen.getByTestId("study-child")).toBeInTheDocument();
  });
});
