import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Mount a tutor-side screen inside a memory-router so its `<Link>`s
 * resolve. Mirrors the production `tutor/<segment>` shape: a parent
 * `tutor` route with the screen and any sibling targets registered as
 * children. Typed `useParams({ from: "/tutor/<path>" })` resolves
 * because the path strings line up.
 *
 * The pattern stays small because every tutor screen sits one level
 * under `/tutor` — student-side screens have their own helper in their
 * test file.
 */
export interface MountTutorOptions {
  /** The route segment under `/tutor`, e.g. `students/$studentId`. */
  path: string;
  screen: () => ReactNode;
  initialEntry?: string;
  /** Sibling segments under `/tutor` we link to (rendered as nulls). */
  siblings?: string[];
}

export function mountTutorScreen({
  path,
  screen: Screen,
  initialEntry,
  siblings = [],
}: MountTutorOptions): { unmount: () => void; client: QueryClient } {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const tutorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "tutor",
    component: () => <Outlet />,
  });
  const screenRoute = createRoute({
    getParentRoute: () => tutorRoute,
    path,
    component: Screen as () => ReactNode,
  });
  const siblingRoutes = siblings.map((p) =>
    createRoute({
      getParentRoute: () => tutorRoute,
      path: p,
      component: NullScreen,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren([tutorRoute.addChildren([screenRoute, ...siblingRoutes])]),
    history: createMemoryHistory({
      initialEntries: [initialEntry ?? `/tutor/${stripParams(path)}`],
    }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { unmount: result.unmount, client };
}

function NullScreen(): ReactNode {
  return null;
}

function stripParams(path: string): string {
  // Replace `$id` with `1` so the default initial entry is a valid URL.
  return path.replace(/\$\w+/g, "1");
}
