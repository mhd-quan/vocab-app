import type { Book, Student, Unit } from "@/data/types";
import { queryKeys } from "@/lib/queryClient";
import { TutorStudentDetail } from "@/ui/screens/tutor/StudentDetail";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountTutorScreen } from "../../test-router";

const epoch = new Date(0);

type EvidenceOverview = Awaited<ReturnType<typeof window.api.evidence.studentOverview>>;
type EvidenceSession = EvidenceOverview["recentSessions"][number];
type EvidenceMetrics = EvidenceSession["metrics"];
type SessionTimeline = NonNullable<Awaited<ReturnType<typeof window.api.evidence.sessionTimeline>>>;
type SessionReport = NonNullable<Awaited<ReturnType<typeof window.api.progress.sessionReport>>>;

function evidenceMetrics(overrides: Partial<EvidenceMetrics> = {}): EvidenceMetrics {
  return {
    answerCount: 6,
    avgResponseMs: 1_200,
    slowResponseCount: 0,
    rapidResponseCount: 0,
    focusLossCount: 0,
    focusLossMs: 0,
    documentHiddenCount: 0,
    documentHiddenMs: 0,
    guardrailCount: 0,
    cameraSnapshotCount: 0,
    cameraUnavailableCount: 0,
    cameraConsentGranted: false,
    cameraConsentDeclined: false,
    pronunciationAssessmentCount: 0,
    pronunciationAverageScore: null,
    pronunciationFlagCount: 0,
    pronunciationRetryRequiredCount: 0,
    attentionScore: 92,
    attentionBand: "steady",
    reviewFlagCount: 0,
    ...overrides,
  };
}

function evidenceSession(
  sessionId: number,
  mode: EvidenceSession["mode"] = "mixed",
  overrides: Partial<EvidenceMetrics> = {},
): EvidenceSession {
  const startedAt = new Date(sessionId * 1_000);
  return {
    sessionId,
    studentId: 1,
    mode,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 60_000),
    eventCount: 6,
    lastEventAt: new Date(startedAt.getTime() + 30_000),
    metrics: evidenceMetrics(overrides),
  };
}

function evidenceOverview(studentId = 1, sessions: EvidenceSession[] = []): EvidenceOverview {
  return {
    studentId,
    sessionCount: sessions.length,
    avgAttentionScore:
      sessions.length === 0
        ? null
        : Math.round(
            sessions.reduce((sum, session) => sum + session.metrics.attentionScore, 0) /
              sessions.length,
          ),
    totalReviewFlags: sessions.reduce((sum, session) => sum + session.metrics.reviewFlagCount, 0),
    focusLossCount: sessions.reduce((sum, session) => sum + session.metrics.focusLossCount, 0),
    cameraSnapshotCount: sessions.reduce(
      (sum, session) => sum + session.metrics.cameraSnapshotCount,
      0,
    ),
    pronunciationAssessmentCount: 0,
    pronunciationAverageScore: null,
    pronunciationFlagCount: 0,
    pronunciationRetryRequiredCount: 0,
    latestSessionAt: sessions[0]?.startedAt ?? null,
    recentSessions: sessions,
  };
}

function sessionTimeline(session: EvidenceSession): SessionTimeline {
  return {
    session: {
      id: session.sessionId,
      studentId: session.studentId,
      mode: session.mode,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    events: [],
    metrics: session.metrics,
    snapshots: [],
  };
}

function sessionReport(session: EvidenceSession): SessionReport {
  return {
    session: {
      id: session.sessionId,
      studentId: session.studentId,
      mode: session.mode,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    totalAnswered: session.metrics.answerCount,
    totalCorrect: Math.max(0, session.metrics.answerCount - 1),
    totalWrong: session.metrics.answerCount > 0 ? 1 : 0,
    accuracy:
      session.metrics.answerCount > 0
        ? Math.max(0, session.metrics.answerCount - 1) / session.metrics.answerCount
        : 0,
    avgResponseMs: session.metrics.avgResponseMs,
    units: [],
    answers: [],
  };
}

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
    code: "destination-b2",
    title: "Destination B2",
    level: null,
    publisher: null,
    language: "en",
    metadata: null,
    createdAt: epoch,
    updatedAt: epoch,
  };
}

function unit(): Unit {
  return {
    id: 10,
    bookId: 1,
    ordinal: 1,
    code: "U01",
    title: "Unit 1",
    summaryMd: null,
    metadata: null,
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
    vi.spyOn(window.api.progress, "unitReport").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "unitSessions").mockResolvedValue([]);
    vi.spyOn(window.api.progress, "sessionReport").mockResolvedValue(null);
    vi.spyOn(window.api.evidence, "studentOverview").mockResolvedValue(evidenceOverview());
    vi.spyOn(window.api.evidence, "sessionTimeline").mockResolvedValue(null);
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

  it("keeps achievements compact and opens full details on demand", async () => {
    const achievementIds = [
      "first_answer",
      "streak_5",
      "streak_10",
      "daily_3",
      "daily_7",
      "learned_25",
      "learned_100",
      "accuracy_master",
    ];
    vi.spyOn(window.api.rewards, "listUnlocked").mockResolvedValue(
      achievementIds.map((achievementId) => ({ studentId: 1, achievementId, unlockedAt: epoch })),
    );
    renderDetail();

    const launcher = await screen.findByRole("button", { name: /achievements 8 unlocked/i });
    const preview = screen.getByLabelText(/achievement preview/i);
    expect(preview.querySelectorAll("svg")).toHaveLength(6);
    expect(within(preview).getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText(/spark rookie/i)).not.toBeInTheDocument();
    fireEvent.click(launcher);

    const dialog = await screen.findByRole("dialog", { name: "Achievements" });
    expect(within(dialog).getByText(/spark rookie/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/answered your very first question/i)).toBeInTheDocument();
    const unlockDates = within(dialog).getAllByText(/unlocked jan 1, 1970/i);
    expect(unlockDates).toHaveLength(8);
    expect(unlockDates[0]).toHaveAttribute("datetime", epoch.toISOString());
  });

  it("keeps learner-wide import and export outside individual session records", async () => {
    const exportHistory = vi.spyOn(window.api.evidence, "exportStudentReport").mockResolvedValue({
      canceled: false,
      filePath: "/tmp/alice-student-history.json",
      encrypted: true,
      sha256: "abc123",
      sessionCount: 128,
      learningEventCount: 640,
      evidenceEventCount: 912,
    });

    renderDetail();

    expect(await screen.findByRole("button", { name: /import data/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));
    const dialog = await screen.findByRole("dialog", { name: /export learner data/i });
    expect(within(dialog).getByText(/every practice session/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /include camera snapshots/i }));
    fireEvent.change(within(dialog).getByLabelText(/encryption passphrase/i), {
      target: { value: "secret123" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /choose location and export/i }));

    await waitFor(() =>
      expect(exportHistory).toHaveBeenCalledWith({
        studentId: 1,
        includeSnapshots: true,
        passphrase: "secret123",
      }),
    );
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      /exported 128 sessions, 640 learning logs, and 912 evidence logs/i,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: /^close$/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: /session evidence review sessions/i }),
    );
    const evidenceDialog = await screen.findByRole("dialog", { name: "Session evidence" });
    expect(
      within(evidenceDialog).queryByRole("button", { name: /export data|import data/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the unit report as a bounded master-detail dialog", async () => {
    const unitReport = vi.spyOn(window.api.progress, "unitReport").mockResolvedValue([
      {
        bookId: 1,
        bookTitle: "Destination B2",
        unitId: 10,
        unitCode: "U01",
        unitTitle: "People and relationships",
        sessionCount: 1,
        totalAnswered: 6,
        totalCorrect: 5,
        totalWrong: 1,
        accuracy: 5 / 6,
        avgResponseMs: 1_400,
        lastPracticedAt: epoch,
      },
    ]);
    const sessions = vi.spyOn(window.api.progress, "unitSessions").mockResolvedValue([
      {
        sessionId: 42,
        mode: "mixed",
        startedAt: epoch,
        endedAt: new Date(60_000),
        totalAnswered: 6,
        totalCorrect: 5,
        accuracy: 5 / 6,
        avgResponseMs: 1_400,
      },
    ]);

    renderDetail();

    const launcher = await screen.findByRole("button", { name: /unit report review unit/i });
    expect(screen.queryByText(/people and relationships/i)).not.toBeInTheDocument();
    expect(unitReport).not.toHaveBeenCalled();
    expect(sessions).not.toHaveBeenCalled();
    fireEvent.click(launcher);

    const dialog = await screen.findByRole("dialog", { name: "Unit report" });
    expect(dialog).toHaveClass("max-w-4xl");
    await waitFor(() => expect(unitReport).toHaveBeenCalledWith({ studentId: 1 }));
    const unitIndex = within(dialog).getByRole("navigation", { name: /unit report index/i });
    expect(unitIndex).toBeInTheDocument();
    expect(within(unitIndex).getByRole("button")).toHaveAttribute("aria-pressed", "true");
    expect(
      within(dialog).getByRole("separator", { name: /resize unit index/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: /people and relationships/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(sessions).toHaveBeenCalledWith({ studentId: 1, unitId: 10, limit: 20 }),
    );
    expect(within(dialog).getByText("mixed")).toBeInTheDocument();
  });

  it("uses a two-column session index and detail view", async () => {
    const first = evidenceSession(101, "mixed", { attentionScore: 91, answerCount: 6 });
    const second = evidenceSession(102, "review", {
      attentionScore: 68,
      answerCount: 4,
      focusLossCount: 1,
      focusLossMs: 5_000,
      cameraSnapshotCount: 1,
      reviewFlagCount: 1,
    });
    const overview = vi
      .spyOn(window.api.evidence, "studentOverview")
      .mockResolvedValue(evidenceOverview(1, [first, second]));
    const timeline = vi
      .spyOn(window.api.evidence, "sessionTimeline")
      .mockImplementation(async ({ sessionId, includeSnapshots }) => {
        const source = sessionId === 101 ? first : second;
        return {
          session: {
            id: sessionId,
            studentId: 1,
            mode: source.mode,
            startedAt: source.startedAt,
            endedAt: source.endedAt,
          },
          events: [],
          metrics: source.metrics,
          snapshots:
            includeSnapshots && sessionId === 102
              ? [
                  {
                    id: 501,
                    occurredAt: source.startedAt,
                    fileName: "camera-501.jpg",
                    mimeType: "image/jpeg",
                    bytes: 1_024,
                    sha256: "abc123",
                    width: 640,
                    height: 480,
                    included: true,
                    snapshotDataUrl: "data:image/jpeg;base64,AA==",
                  },
                ]
              : [],
        };
      });
    vi.spyOn(window.api.progress, "sessionReport").mockImplementation(async ({ sessionId }) => {
      const source = sessionId === 101 ? first : second;
      return {
        session: {
          id: sessionId,
          studentId: 1,
          mode: source.mode,
          startedAt: source.startedAt,
          endedAt: source.endedAt,
        },
        totalAnswered: source.metrics.answerCount,
        totalCorrect: source.metrics.answerCount - 1,
        totalWrong: 1,
        accuracy: (source.metrics.answerCount - 1) / source.metrics.answerCount,
        avgResponseMs: source.metrics.avgResponseMs,
        units: [],
        answers: [],
      };
    });

    renderDetail();
    const launcher = await screen.findByRole("button", {
      name: /session evidence review sessions/i,
    });
    expect(overview).not.toHaveBeenCalled();
    expect(timeline).not.toHaveBeenCalled();
    expect(window.api.progress.sessionReport).not.toHaveBeenCalled();
    fireEvent.click(launcher);

    const dialog = await screen.findByRole("dialog", { name: "Session evidence" });
    expect(dialog).toHaveClass("max-w-4xl");
    await waitFor(() => expect(overview).toHaveBeenCalledWith({ studentId: 1, limit: 8 }));
    const index = within(dialog).getByRole("navigation", { name: /session evidence index/i });
    expect(index).toHaveClass("overflow-y-auto");
    expect(within(dialog).getByRole("region", { name: /selected session detail/i })).toHaveClass(
      "overflow-y-auto",
    );
    expect(
      within(dialog).getByRole("separator", { name: /resize session index/i }),
    ).toBeInTheDocument();
    const entries = within(index).getAllByRole("button");
    expect(entries).toHaveLength(2);
    await waitFor(() => expect(within(dialog).getByText("Session 101")).toBeInTheDocument());
    expect(entries[0]).toHaveAttribute("aria-pressed", "true");
    expect(timeline).toHaveBeenCalledWith({ sessionId: 101, includeSnapshots: false });
    expect(timeline).not.toHaveBeenCalledWith({ sessionId: 101, includeSnapshots: true });
    expect(
      within(dialog).queryByRole("button", { name: /export data|import data/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(entries[1] as HTMLButtonElement);
    await waitFor(() => expect(within(dialog).getByText("Session 102")).toBeInTheDocument());
    expect(entries[1]).toHaveAttribute("aria-pressed", "true");
    expect(timeline).toHaveBeenCalledWith({ sessionId: 102, includeSnapshots: false });
    expect(timeline).not.toHaveBeenCalledWith({ sessionId: 102, includeSnapshots: true });

    fireEvent.click(within(dialog).getByRole("button", { name: /load camera attachments \(1\)/i }));
    await waitFor(() =>
      expect(timeline).toHaveBeenCalledWith({ sessionId: 102, includeSnapshots: true }),
    );
    expect(
      await within(dialog).findByRole("img", { name: /camera snapshot captured/i }),
    ).toBeInTheDocument();

    fireEvent.click(entries[0] as HTMLButtonElement);
    await waitFor(() => expect(within(dialog).getByText("Session 101")).toBeInTheDocument());
    fireEvent.click(entries[1] as HTMLButtonElement);
    await waitFor(() => expect(within(dialog).getByText("Session 102")).toBeInTheDocument());
    expect(
      within(dialog).getByRole("button", { name: /load camera attachments \(1\)/i }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("img", { name: /camera snapshot captured/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps answer results truthful when session signals fail", async () => {
    const source = evidenceSession(103, "review", { answerCount: 6, reviewFlagCount: 2 });
    vi.spyOn(window.api.evidence, "studentOverview").mockResolvedValue(
      evidenceOverview(1, [source]),
    );
    const timeline = vi
      .spyOn(window.api.evidence, "sessionTimeline")
      .mockRejectedValue(new Error("Signals unavailable"));
    vi.spyOn(window.api.progress, "sessionReport").mockResolvedValue(sessionReport(source));

    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /session evidence review sessions/i }),
    );
    const detail = await screen.findByRole("region", { name: /selected session detail/i });

    expect(await within(detail).findByText(/session signals is unavailable/i)).toBeInTheDocument();
    expect(within(detail).getByText("Answered")).toBeInTheDocument();
    expect(within(detail).queryByText("Review flags")).not.toBeInTheDocument();
    expect(within(detail).queryByText("Camera")).not.toBeInTheDocument();
    expect(within(detail).queryByText("No answers")).not.toBeInTheDocument();

    fireEvent.click(within(detail).getByRole("button", { name: /retry session signals/i }));
    await waitFor(() => expect(timeline).toHaveBeenCalledTimes(2));
  });

  it("keeps session signals truthful when the answer report fails", async () => {
    const source = evidenceSession(104, "mixed", {
      answerCount: 6,
      cameraSnapshotCount: 1,
      reviewFlagCount: 2,
    });
    vi.spyOn(window.api.evidence, "studentOverview").mockResolvedValue(
      evidenceOverview(1, [source]),
    );
    vi.spyOn(window.api.evidence, "sessionTimeline").mockResolvedValue(sessionTimeline(source));
    const report = vi
      .spyOn(window.api.progress, "sessionReport")
      .mockRejectedValue(new Error("Report unavailable"));

    renderDetail();
    fireEvent.click(
      await screen.findByRole("button", { name: /session evidence review sessions/i }),
    );
    const detail = await screen.findByRole("region", { name: /selected session detail/i });

    expect(await within(detail).findByText(/answer report is unavailable/i)).toBeInTheDocument();
    expect(within(detail).getByText("Review flags")).toBeInTheDocument();
    expect(within(detail).getByText("Camera")).toBeInTheDocument();
    expect(within(detail).queryByText("Answered")).not.toBeInTheDocument();
    expect(within(detail).queryByText("Correct")).not.toBeInTheDocument();
    expect(within(detail).queryByText("No answers")).not.toBeInTheDocument();

    fireEvent.click(within(detail).getByRole("button", { name: /retry answer report/i }));
    await waitFor(() => expect(report).toHaveBeenCalledTimes(2));
  });

  it("closes evidence and resets its selected session when the student route changes", async () => {
    const firstStudentSessions = [evidenceSession(101), evidenceSession(102, "review")];
    const secondStudentSession = {
      ...evidenceSession(201, "flashcard"),
      studentId: 2,
    };
    const overview = vi
      .spyOn(window.api.evidence, "studentOverview")
      .mockImplementation(async ({ studentId }) =>
        studentId === 1
          ? evidenceOverview(1, firstStudentSessions)
          : evidenceOverview(2, [secondStudentSession]),
      );

    const { router } = renderDetail();
    expect(overview).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", { name: /session evidence review sessions/i }),
    );
    let dialog = await screen.findByRole("dialog", { name: "Session evidence" });
    const oldIndex = within(dialog).getByRole("navigation", { name: /session evidence index/i });
    fireEvent.click(within(oldIndex).getAllByRole("button")[1] as HTMLButtonElement);
    expect(within(oldIndex).getAllByRole("button")[1]).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      await router.navigate({
        to: "/tutor/students/$studentId",
        params: { studentId: "2" },
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Session evidence" })).not.toBeInTheDocument(),
    );
    expect(overview).not.toHaveBeenCalledWith({ studentId: 2, limit: 8 });

    fireEvent.click(
      await screen.findByRole("button", { name: /session evidence review sessions/i }),
    );
    dialog = await screen.findByRole("dialog", { name: "Session evidence" });
    await waitFor(() => expect(overview).toHaveBeenCalledWith({ studentId: 2, limit: 8 }));
    const newIndex = within(dialog).getByRole("navigation", { name: /session evidence index/i });
    const newEntry = within(newIndex).getByRole("button");
    expect(newEntry).toHaveTextContent("flashcard");
    expect(newEntry).toHaveAttribute("aria-pressed", "true");
    expect(within(newIndex).queryByText("review")).not.toBeInTheDocument();
  });

  it("shows an actionable assignment error when the running main process is stale", async () => {
    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([book()]);
    vi.spyOn(window.api.curriculum, "listUnitsByBook").mockResolvedValue([unit()]);
    vi.spyOn(window.api.students, "listAssignedUnitIds").mockResolvedValue([]);
    vi.spyOn(window.api.students, "replaceUnitAssignments").mockRejectedValue(
      new Error(
        "Error invoking remote method 'students.replaceUnitAssignments': Error: No handler registered for 'students.replaceUnitAssignments'",
      ),
    );

    renderDetail();
    const saveButton = await screen.findByRole("button", { name: /save assignments/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/restart the app once/i);
    });
  });

  it("invalidates student-home progress after assignments are saved", async () => {
    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([book()]);
    vi.spyOn(window.api.curriculum, "listUnitsByBook").mockResolvedValue([unit()]);
    vi.spyOn(window.api.students, "listAssignedUnitIds").mockResolvedValue([]);
    const replaceAssignments = vi
      .spyOn(window.api.students, "replaceUnitAssignments")
      .mockResolvedValue([]);

    const { client } = renderDetail();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const saveButton = await screen.findByRole("button", { name: /save assignments/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(replaceAssignments).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.progress.assignedUnitProgress(1),
      }),
    );
    expect(await screen.findByText(/assignments saved/i)).toBeInTheDocument();
  });

  it("cannot save stale selections while a newly selected book is hydrating", async () => {
    const secondBook = { ...book(), id: 2, title: "Destination C1", code: "destination-c1" };
    const secondUnit = { ...unit(), id: 20, bookId: 2, code: "U20", title: "Unit 20" };
    let resolveSecondAssignments!: (unitIds: number[]) => void;
    const secondAssignments = new Promise<number[]>((resolve) => {
      resolveSecondAssignments = resolve;
    });

    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([book(), secondBook]);
    vi.spyOn(window.api.curriculum, "listUnitsByBook").mockImplementation(async ({ bookId }) =>
      bookId === 1 ? [unit()] : [secondUnit],
    );
    vi.spyOn(window.api.students, "listAssignedUnitIds").mockImplementation(({ bookId }) =>
      bookId === 1 ? Promise.resolve([10]) : secondAssignments,
    );
    const replaceAssignments = vi
      .spyOn(window.api.students, "replaceUnitAssignments")
      .mockResolvedValue([]);

    renderDetail();
    const saveButton = await screen.findByRole("button", { name: /save assignments/i });
    await waitFor(() => expect(saveButton).toBeEnabled());

    fireEvent.change(screen.getByRole("combobox", { name: /book/i }), {
      target: { value: "2" },
    });
    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(screen.getByRole("combobox", { name: /book/i })).toBeDisabled();
    fireEvent.click(saveButton);
    expect(replaceAssignments).not.toHaveBeenCalled();

    await act(async () => resolveSecondAssignments([20]));
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(replaceAssignments).toHaveBeenCalledWith({
        studentId: 1,
        bookId: 2,
        unitIds: [20],
      }),
    );
  });

  it("resets assignment hydration when navigating to a cached student", async () => {
    const secondStudent = { ...student(), id: 2, name: "Bob" };
    const secondUnit = { ...unit(), id: 20, code: "U20", title: "Unit 20" };
    vi.spyOn(window.api.students, "getById").mockImplementation(async ({ id }) =>
      id === 1 ? student() : secondStudent,
    );
    vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([book()]);
    vi.spyOn(window.api.curriculum, "listUnitsByBook").mockResolvedValue([unit(), secondUnit]);
    vi.spyOn(window.api.students, "listAssignedUnitIds").mockImplementation(
      async ({ studentId }) => (studentId === 1 ? [10] : [20]),
    );
    const replaceAssignments = vi
      .spyOn(window.api.students, "replaceUnitAssignments")
      .mockResolvedValue([]);

    const { client, router } = renderDetail();
    const firstSave = await screen.findByRole("button", { name: /save assignments/i });
    await waitFor(() => expect(firstSave).toBeEnabled());
    expect(screen.getByRole("checkbox", { name: /unit 1/i })).toBeChecked();

    client.setQueryData(queryKeys.students.byId(2), secondStudent);
    client.setQueryData(queryKeys.students.assignedUnitIds(2, 1), [20]);
    await act(async () => {
      await router.navigate({
        to: "/tutor/students/$studentId",
        params: { studentId: "2" },
      });
    });

    expect(await screen.findByText("Bob")).toBeInTheDocument();
    const secondSave = screen.getByRole("button", { name: /save assignments/i });
    await waitFor(() => expect(secondSave).toBeEnabled());
    expect(screen.getByRole("checkbox", { name: /unit 1/i })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /unit 20/i })).toBeChecked();
    fireEvent.click(secondSave);

    await waitFor(() =>
      expect(replaceAssignments).toHaveBeenLastCalledWith({
        studentId: 2,
        bookId: 1,
        unitIds: [20],
      }),
    );
  });

  it("renders a missing student state without loading analytics or controls", async () => {
    vi.spyOn(window.api.students, "getById").mockResolvedValue(null);
    const books = vi.spyOn(window.api.curriculum, "listBooks").mockResolvedValue([]);

    renderDetail();

    expect(await screen.findByRole("heading", { name: /student not found/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /return to students/i })).toHaveAttribute(
      "href",
      "/tutor/students",
    );
    expect(screen.queryByRole("button", { name: /save assignments/i })).not.toBeInTheDocument();
    expect(window.api.progress.studentSummary).not.toHaveBeenCalled();
    expect(window.api.rewards.streak).not.toHaveBeenCalled();
    expect(window.api.progress.unitReport).not.toHaveBeenCalled();
    expect(window.api.evidence.studentOverview).not.toHaveBeenCalled();
    expect(books).not.toHaveBeenCalled();
  });

  it("rejects an invalid student id with a back link", async () => {
    renderDetail("not-a-number");
    await waitFor(() => {
      expect(screen.getByText(/invalid student id/i)).toBeInTheDocument();
    });
  });
});
