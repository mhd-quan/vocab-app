import type { Student } from "@/data/types";
import { TutorStudents } from "@/ui/screens/tutor/Students";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTutorScreen } from "../../test-router";

function makeStudent(overrides: Partial<Student> = {}): Student {
  const now = new Date();
  return {
    id: 1,
    name: "Alice",
    displayName: null,
    avatarSeed: null,
    color: null,
    pinHash: null,
    notes: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function renderScreen() {
  return mountTutorScreen({
    path: "students",
    screen: TutorStudents,
    siblings: ["students/$studentId"],
  });
}

describe("TutorStudents", () => {
  beforeEach(() => {
    vi.spyOn(window.api.students, "listAll").mockResolvedValue([]);
    vi.spyOn(window.api.students, "create").mockImplementation(async (input) =>
      makeStudent({ id: 99, name: input.name, color: input.color ?? null }),
    );
    vi.spyOn(window.api.students, "update").mockImplementation(async ({ id, patch }) =>
      makeStudent({
        id,
        name: patch.name ?? "Alice",
        displayName: patch.displayName ?? null,
        notes: patch.notes ?? null,
      }),
    );
    vi.spyOn(window.api.students, "archive").mockResolvedValue({ ok: true });
    vi.spyOn(window.api.students, "restore").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when no active students exist", async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/No active students/i)).toBeInTheDocument();
    });
  });

  it("renders active students and hides archived ones until the tab is switched", async () => {
    vi.spyOn(window.api.students, "listAll").mockResolvedValue([
      makeStudent({ id: 1, name: "Alice" }),
      makeStudent({ id: 2, name: "Archie", archivedAt: new Date() }),
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.queryByText("Archie")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^archived$/i }));
    await waitFor(() => expect(screen.getByText("Archie")).toBeInTheDocument());
    expect(screen.queryByText("Alice")).toBeNull();
  });

  it("create flow: opens modal, validates required name, calls create, refetches", async () => {
    const listSpy = vi
      .spyOn(window.api.students, "listAll")
      .mockResolvedValueOnce([])
      .mockResolvedValue([makeStudent({ id: 99, name: "Bob" })]);
    renderScreen();

    await waitFor(() => screen.getByText(/No active students/i));
    // Both the header and the empty state expose an "Add student" button —
    // click the first one (the page header action).
    const addButtons = screen.getAllByRole("button", { name: /\+ add student/i });
    const headerAdd = addButtons[0];
    if (!headerAdd) throw new Error("expected an Add student button");
    fireEvent.click(headerAdd);
    const dialog = await screen.findByRole("dialog");

    // Empty name → submitting fails locally with no IPC call.
    fireEvent.click(within(dialog).getByRole("button", { name: /create student/i }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent(/required/i));
    expect(window.api.students.create).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^name$/i), {
      target: { value: "Bob" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /create student/i }));

    await waitFor(() => expect(window.api.students.create).toHaveBeenCalledTimes(1));
    expect(window.api.students.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Bob" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it("archive button calls api.students.archive and refetches the list", async () => {
    vi.spyOn(window.api.students, "listAll")
      .mockResolvedValueOnce([makeStudent({ id: 1, name: "Alice" })])
      .mockResolvedValue([]);
    renderScreen();
    await waitFor(() => screen.getByText("Alice"));
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(window.api.students.archive).toHaveBeenCalledWith({ id: 1 }));
    await waitFor(() => screen.getByText(/No active students/i));
  });
});
