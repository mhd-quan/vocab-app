import type { Student } from "@/data/types";
import { StudentProfilePicker } from "@/ui/screens/student/ProfilePicker";
import { clearUnlockedStudentProfiles, isStudentUnlocked } from "@/ui/student/access";
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

const epoch = new Date(0);

function makeStudent(overrides: Partial<Student> = {}): Student {
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
    ...overrides,
  };
}

function renderPicker() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const studentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "student",
    component: () => <Outlet />,
  });
  const pickerRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "/",
    component: StudentProfilePicker,
  });
  const profileRoute = createRoute({
    getParentRoute: () => studentRoute,
    path: "profile/$studentId",
    component: () => <div>Unlocked profile</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([studentRoute.addChildren([pickerRoute, profileRoute])]),
    history: createMemoryHistory({ initialEntries: ["/student"] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("StudentProfilePicker", () => {
  beforeEach(() => {
    vi.spyOn(window.api.students, "listActive").mockResolvedValue([makeStudent()]);
  });

  afterEach(() => {
    clearUnlockedStudentProfiles();
    vi.restoreAllMocks();
  });

  it("opens unprotected profiles and marks them unlocked for the current session", async () => {
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(false);

    renderPicker();

    expect(
      await screen.findByText(/Choose a profile to open its learning path/i),
    ).toBeInTheDocument();
    const profile = await screen.findByRole("button", { name: /Alice.*Open learning path/i });
    expect(profile).toHaveAttribute("data-state", "ready");
    fireEvent.click(profile);

    await waitFor(() => expect(screen.getByText("Unlocked profile")).toBeInTheDocument());
    expect(isStudentUnlocked(1)).toBe(true);
  });

  it("requires the student PIN for protected profiles", async () => {
    vi.spyOn(window.api.students, "hasPin").mockResolvedValue(true);
    vi.spyOn(window.api.students, "verifyPin")
      .mockResolvedValueOnce({ ok: false, reason: "invalid" })
      .mockResolvedValueOnce({ ok: true });

    renderPicker();

    await screen.findByText(/PIN required/i);
    const profile = screen.getByRole("button", { name: /Alice/i });
    expect(profile).toHaveAttribute("data-state", "locked");
    fireEvent.click(profile);
    const dialog = await screen.findByRole("dialog", { name: "Unlock Alice" });
    const input = within(dialog).getByLabelText(/Alice PIN/i);

    fireEvent.change(input, { target: { value: "0000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /unlock/i }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent(/incorrect/i));

    fireEvent.change(input, { target: { value: "1234" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /unlock/i }));

    await waitFor(() =>
      expect(window.api.students.verifyPin).toHaveBeenLastCalledWith({
        studentId: 1,
        pin: "1234",
      }),
    );
    await waitFor(() => expect(screen.getByText("Unlocked profile")).toBeInTheDocument());
    expect(isStudentUnlocked(1)).toBe(true);
  });
});
