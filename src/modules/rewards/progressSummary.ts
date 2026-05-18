export interface StudentProgressStats {
  totalSeen: number;
  totalCorrect: number;
  totalWrong: number;
  accuracy: number;
  streakDays: number;
  practicedToday?: boolean;
}

export interface StudentProgressSummary {
  xp: number;
  accuracyPct: number;
  wordsLabel: string;
  headline: string;
  note: string;
}

export function computeStudentXp(stats: StudentProgressStats): number {
  const attempts = stats.totalCorrect + stats.totalWrong;
  const accuracyBonus = attempts > 0 ? Math.round(stats.accuracy * 100) : 0;
  const streakBonus = Math.min(Math.max(stats.streakDays, 0), 30) * 5;
  return Math.max(0, stats.totalSeen * 10 + stats.totalCorrect * 2 + accuracyBonus + streakBonus);
}

export function summarizeStudentProgress(stats: StudentProgressStats): StudentProgressSummary {
  const attempts = stats.totalCorrect + stats.totalWrong;
  const accuracyPct = attempts > 0 ? Math.round(stats.accuracy * 100) : 0;
  const xp = computeStudentXp(stats);
  const wordsLabel = `${stats.totalSeen} ${stats.totalSeen === 1 ? "word" : "words"}`;

  if (stats.totalSeen === 0) {
    return {
      xp,
      accuracyPct,
      wordsLabel,
      headline: "Ready for your first word",
      note: "Start with one short session. A few careful answers are enough to begin a streak.",
    };
  }

  if (stats.streakDays >= 7) {
    return {
      xp,
      accuracyPct,
      wordsLabel,
      headline: "A full-week learning streak",
      note: "You are turning practice into a habit. Keep today light if you need to, but keep it alive.",
    };
  }

  if (accuracyPct >= 90 && attempts >= 20) {
    return {
      xp,
      accuracyPct,
      wordsLabel,
      headline: "Excellent accuracy",
      note: "Your answers are precise. Try a review round to lock these words into long-term memory.",
    };
  }

  if (stats.totalSeen >= 50) {
    return {
      xp,
      accuracyPct,
      wordsLabel,
      headline: "Your word bank is growing",
      note: "You have covered a lot of ground. Focus on due cards before adding too many new words.",
    };
  }

  return {
    xp,
    accuracyPct,
    wordsLabel,
    headline: "Good progress so far",
    note: stats.practicedToday
      ? "You already practised today. A short review later will make tomorrow easier."
      : "A short session today can keep your progress moving without feeling heavy.",
  };
}
