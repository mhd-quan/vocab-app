import type { Student } from "@/data/types";
import { TutorDashboard } from "@/ui/screens/tutor/Dashboard";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTutorScreen } from "../../test-router";

const epoch = new Date(0);

function student(overrides: Partial<Student> = {}): Student {
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

function renderDashboard() {
  return mountTutorScreen({
    path: "dashboard",
    screen: TutorDashboard,
    siblings: ["students", "students/$studentId", "content"],
  });
}

describe("TutorDashboard", () => {
  beforeEach(() => {
    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([]);
    vi.spyOn(window.api.students, "listActive").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty-state when no active students exist", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/no active students/i)).toBeInTheDocument();
    });
  });

  it("renders the per-student roll-up table with names + accuracy badges", async () => {
    vi.spyOn(window.api.students, "listActive").mockResolvedValue([
      student({ id: 1, name: "Alice" }),
      student({ id: 2, name: "Bob", displayName: "Bobby" }),
    ]);
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([
      {
        student: { id: 1, name: "Alice", displayName: null, color: null } as Student,
        totalSeen: 12,
        totalDue: 3,
        accuracy: 0.85,
        lastPracticedAt: new Date(),
      },
      {
        student: { id: 2, name: "Bob", displayName: "Bobby", color: null } as Student,
        totalSeen: 0,
        totalDue: 0,
        accuracy: 0,
        lastPracticedAt: null,
      },
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("Bobby")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    // Bob has zero practice → accuracy column shows the em-dash placeholder.
    const bobRow = screen.getByText("Bobby").closest("tr");
    expect(bobRow).not.toBeNull();
    if (bobRow) {
      // No accuracy badge on the empty row.
      expect(bobRow.textContent).toContain("—");
    }
  });

  it("links each row to the student detail screen", async () => {
    vi.spyOn(window.api.students, "listActive").mockResolvedValue([student({ id: 7 })]);
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([
      {
        student: { id: 7, name: "Alice", displayName: null, color: null } as Student,
        totalSeen: 1,
        totalDue: 0,
        accuracy: 1,
        lastPracticedAt: new Date(),
      },
    ]);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    const aliceLink = screen.getByText("Alice").closest("a");
    expect(aliceLink?.getAttribute("href")).toBe("/tutor/students/7");
  });
});
