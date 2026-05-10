import type { Student } from "@/data/types";
import { TutorStudentDetail } from "@/ui/screens/tutor/StudentDetail";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTutorScreen } from "../../test-router";

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

function renderDetail(studentId = "1") {
  return mountTutorScreen({
    path: "students/$studentId",
    screen: TutorStudentDetail,
    siblings: ["students", "content"],
    initialEntry: `/tutor/students/${studentId}`,
  });
}

describe("TutorStudentDetail", () => {
  beforeEach(() => {
    vi.spyOn(window.api.students, "getById").mockResolvedValue(student());
    vi.spyOn(window.api.progress, "studentSummary").mockResolvedValue({
      totalSeen: 0,
      totalCorrect: 0,
      totalWrong: 0,
      accuracy: 0,
      totalDue: 0,
    });
    vi.spyOn(window.api.rewards, "streak").mockResolvedValue({
      currentStreak: 0,
      longestStreak: 0,
      lastPracticedAt: null,
      practicedToday: false,
    });
    vi.spyOn(window.api.rewards, "listUnlocked").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "weakItems").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "recentSessions").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "dailyActivity").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the student name in the header", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
  });

  it("renders the four key stats with em-dash placeholders for an empty student", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("Seen")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();
    expect(screen.getByText("Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Streak")).toBeInTheDocument();
  });

  it("surfaces weak words with a deep link to the content browser", async () => {
    vi.spyOn(window.api.progress, "weakItems").mockResolvedValue([
      {
        entryId: 99,
        contentItemId: 200,
        lessonId: 50,
        bookId: 1,
        headword: "relative",
        pos: "noun",
        totalCorrect: 1,
        totalWrong: 4,
        accuracy: 0.2,
        lastSeenAt: new Date(),
      },
    ]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("relative")).toBeInTheDocument();
    });
    const link = screen.getByText("relative").closest("a");
    expect(link?.getAttribute("href")).toContain("/tutor/content");
    expect(link?.getAttribute("href")).toContain("entry=99");
    expect(link?.getAttribute("href")).toContain("book=1");
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("renders unlocked achievements via the catalogue", async () => {
    vi.spyOn(window.api.rewards, "listUnlocked").mockResolvedValue([
      { studentId: 1, achievementId: "first_answer", unlockedAt: epoch },
    ]);
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText(/first steps/i)).toBeInTheDocument();
    });
  });

  it("rejects an invalid student id with a back link", async () => {
    renderDetail("not-a-number");
    await waitFor(() => {
      expect(screen.getByText(/invalid student id/i)).toBeInTheDocument();
    });
  });
});
