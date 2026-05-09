import { useAppMode } from "@/providers/AppModeProvider";
import { router } from "@/router";
import { UnlockScreen } from "@/ui/screens/UnlockScreen";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Top-level decision point: which tree do we render?
 *
 *   loading  → centered spinner (until the hasPin probe resolves)
 *   locked   → standalone UnlockScreen (no router; locked sessions can't
 *              be navigated to deep links)
 *   tutor /
 *   student  → RouterProvider; `useModeRouterSync` keeps the router URL
 *              aligned with the current mode so nav between modes always
 *              lands on a sensible page.
 */
export function AppRoot() {
  const { mode } = useAppMode();

  useEffect(() => {
    if (mode === "tutor") {
      const current = router.state.location.pathname;
      if (!current.startsWith("/tutor")) {
        void router.navigate({ to: "/tutor/dashboard" });
      }
    } else if (mode === "student") {
      const current = router.state.location.pathname;
      if (!current.startsWith("/student")) {
        void router.navigate({ to: "/student" });
      }
    }
  }, [mode]);

  if (mode === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }
  if (mode === "locked") {
    return <UnlockScreen />;
  }
  return <RouterProvider router={router} />;
}
