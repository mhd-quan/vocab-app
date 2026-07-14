import type { Student } from "@/data/types";
import { queryKeys } from "@/lib/queryClient";
import { TutorDashboard } from "@/ui/screens/tutor/Dashboard";
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTutorScreen } from "../../test-router";

const epoch = new Date(0);

type OverviewRow = Awaited<ReturnType<typeof window.api.progress.tutorOverview>>[number];
type EvidenceRow = Awaited<ReturnType<typeof window.api.evidence.tutorOverview>>[number];
type CohortCell = Awaited<ReturnType<typeof window.api.progress.cohortActivity>>[number];

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

function overviewRow(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    student: student(),
    totalSeen: 12,
    totalAttempts: 20,
    totalDue: 0,
    accuracy: 0.85,
    lastPracticedAt: new Date(),
    ...overrides,
  };
}

function evidenceRow(studentId: number, totalReviewFlags: number): EvidenceRow {
  return {
    student: student({ id: studentId }),
    latestSessionAt: new Date(),
    sessionCount: 1,
    avgAttentionScore: 82,
    totalReviewFlags,
    focusLossCount: totalReviewFlags,
    cameraSnapshotCount: 0,
    pronunciationAssessmentCount: 0,
    pronunciationAverageScore: null,
    pronunciationFlagCount: 0,
    pronunciationRetryRequiredCount: 0,
  };
}

function cohortCell(
  day: string,
  answerCount: number,
  correctCount: number,
  activeStudentCount: number,
): CohortCell {
  return {
    bucketStart: new Date(`${day}T00:00:00`),
    answerCount,
    correctCount,
    activeStudentCount,
  };
}

function renderDashboard() {
  return mountTutorScreen({
    path: "dashboard",
    screen: TutorDashboard,
    siblings: ["students", "students/$studentId"],
  });
}

describe("TutorDashboard", () => {
  beforeEach(() => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([]);
    vi.spyOn(window.api.evidence, "tutorOverview").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "cohortActivity").mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows one focused empty state when no active students exist", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/no active students/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /add a student/i })).toHaveAttribute(
      "href",
      "/tutor/students",
    );
  });

  it("stays summary-first and sends full roster work to Students", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([
      overviewRow({ student: student({ id: 1, name: "Alice" }) }),
      overviewRow({
        student: student({ id: 2, name: "Bob", displayName: "Bobby" }),
        totalSeen: 0,
        totalAttempts: 0,
        totalDue: 0,
        accuracy: 0,
        lastPracticedAt: null,
      }),
    ]);

    renderDashboard();

    expect(await screen.findByText(/Bobby is the clearest next follow-up/i)).toBeInTheDocument();
    const attention = screen.getByRole("list", { name: /learners needing attention/i });
    expect(within(attention).getByText("Bobby").closest("a")).toHaveAttribute(
      "href",
      "/tutor/students/2",
    );
    expect(screen.queryByRole("table", { name: /student ledger/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/active profiles/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all students/i })).toHaveAttribute(
      "href",
      "/tutor/students",
    );
    expect(screen.getByRole("link", { name: /open student directory/i })).toHaveAttribute(
      "href",
      "/tutor/students",
    );
  });

  it("exposes the cohort chart and an exact accessible data table", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([overviewRow()]);
    vi.spyOn(window.api.progress, "cohortActivity").mockResolvedValue([
      cohortCell("2026-07-12", 2, 2, 1),
      cohortCell("2026-07-13", 3, 2, 1),
    ]);

    renderDashboard();

    const chart = await screen.findByRole("img", { name: /5 answers, 4 correct, 80 percent/i });
    expect(chart).toBeInTheDocument();
    const exactTable = screen.getByRole("table", { name: /daily cohort answer counts/i });
    expect(within(exactTable).getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/Peak .* · 3/i)).toBeInTheDocument();
  });

  it("shows a purposeful cohort empty state when profiles exist but activity does not", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([overviewRow()]);
    vi.spyOn(window.api.progress, "cohortActivity").mockResolvedValue([
      cohortCell("2026-07-12", 0, 0, 0),
      cohortCell("2026-07-13", 0, 0, 0),
    ]);

    renderDashboard();

    expect(await screen.findByText(/No answers in the last 14 days/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /cohort activity/i })).not.toBeInTheDocument();
  });

  it("announces the cohort loading state while keeping roster navigation available", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([overviewRow()]);
    vi.spyOn(window.api.progress, "cohortActivity").mockReturnValue(new Promise(() => undefined));

    renderDashboard();

    expect(await screen.findByText(/Loading cohort rhythm/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all students/i })).toHaveAttribute(
      "href",
      "/tutor/students",
    );
    expect(screen.getByRole("heading", { name: /needs a follow-up/i })).toBeInTheDocument();
  });

  it("qualifies the all-clear state when session evidence is unavailable", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([overviewRow()]);
    vi.spyOn(window.api.evidence, "tutorOverview").mockRejectedValue(
      new Error("Evidence unavailable"),
    );

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: /progress signals show no urgent follow-up/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/session review evidence is temporarily unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/using practice data only/i);
    expect(screen.getByText(/no progress-based follow-up now/i)).toBeInTheDocument();
    expect(screen.queryByText(/no stale due load, review flags/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cohort has no urgent follow-up signals/i)).not.toBeInTheDocument();
  });

  it("does not assert an all-clear while session evidence is still loading", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([overviewRow()]);
    vi.spyOn(window.api.evidence, "tutorOverview").mockReturnValue(new Promise(() => undefined));

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: /progress signals show no urgent follow-up/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/session review evidence is still loading/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/review flags are still loading/i);
    expect(screen.getByText(/no progress-based follow-up now/i)).toBeInTheDocument();
    expect(screen.queryByText(/no stale due load, review flags/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cohort has no urgent follow-up signals/i)).not.toBeInTheDocument();
  });

  it("removes cached review flags from ranking when the evidence refresh fails", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([overviewRow()]);
    const evidence = vi
      .spyOn(window.api.evidence, "tutorOverview")
      .mockResolvedValue([evidenceRow(1, 2)]);

    const { client } = renderDashboard();
    expect(await screen.findAllByText(/2 recorded review flags/i)).toHaveLength(2);

    evidence.mockRejectedValue(new Error("Evidence refresh failed"));
    await act(async () => {
      await client.refetchQueries({ queryKey: queryKeys.evidence.tutorOverview() });
    });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/using practice data only/i),
    );
    expect(screen.queryAllByText(/2 recorded review flags/i)).toHaveLength(0);
    expect(screen.getByText(/no progress-based follow-up now/i)).toBeInTheDocument();
  });

  it("sorts attention by transparent reasons and ignores weak accuracy samples", async () => {
    vi.spyOn(window.api.progress, "tutorOverview").mockResolvedValue([
      overviewRow({
        student: student({ id: 1, name: "Steady" }),
        totalAttempts: 50,
        accuracy: 0.9,
      }),
      overviewRow({
        student: student({ id: 2, name: "Noah" }),
        totalSeen: 0,
        totalAttempts: 0,
        accuracy: 0,
        lastPracticedAt: null,
      }),
      overviewRow({
        student: student({ id: 3, name: "Stella" }),
        totalDue: 18,
        lastPracticedAt: new Date("2020-01-01T00:00:00"),
      }),
      overviewRow({ student: student({ id: 4, name: "Faye" }) }),
      overviewRow({
        student: student({ id: 5, name: "Leo" }),
        totalAttempts: 20,
        accuracy: 0.55,
      }),
      overviewRow({
        student: student({ id: 6, name: "Tiny sample" }),
        totalAttempts: 2,
        accuracy: 0.5,
      }),
    ]);
    vi.spyOn(window.api.evidence, "tutorOverview").mockResolvedValue([evidenceRow(4, 2)]);

    renderDashboard();

    const list = await screen.findByRole("list", { name: /learners needing attention/i });
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining("Noah"),
      expect.stringContaining("Stella"),
      expect.stringContaining("Faye"),
      expect.stringContaining("Leo"),
    ]);
    expect(within(list).getByText(/No practice yet/i)).toBeInTheDocument();
    expect(within(list).getByText(/18 due after/i)).toBeInTheDocument();
    expect(within(list).getByText(/2 recorded review flags/i)).toBeInTheDocument();
    expect(within(list).getByText(/55% across 20 answers/i)).toBeInTheDocument();
    expect(within(list).queryByText(/Tiny sample/i)).not.toBeInTheDocument();
  });
});
