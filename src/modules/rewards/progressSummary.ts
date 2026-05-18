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
  cue: "start" | "streak" | "accuracy" | "review" | "growth" | "recovery" | "steady";
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
  const context = { ...stats, attempts, accuracyPct, xp, wordsLabel };

  if (stats.totalSeen === 0) {
    return {
      xp,
      accuracyPct,
      wordsLabel,
      cue: "start",
      headline: "Ready for your first word",
      note: "Start with one short session. A few careful answers are enough to begin a streak.",
    };
  }

  const selected = SUMMARY_RULES.find((rule) => rule.when(context)) ?? SUMMARY_RULES.at(-1);
  if (!selected) throw new Error("Missing progress summary rules");
  const variant =
    selected.variants[variantIndex(context, selected.variants.length)] ?? selected.variants[0];
  if (!variant) throw new Error("Missing progress summary variant");
  return {
    xp,
    accuracyPct,
    wordsLabel,
    cue: selected.cue,
    headline: variant.headline,
    note: variant.note,
  };
}

interface SummaryContext extends StudentProgressStats {
  attempts: number;
  accuracyPct: number;
  xp: number;
  wordsLabel: string;
}

interface SummaryRule {
  cue: StudentProgressSummary["cue"];
  when: (stats: SummaryContext) => boolean;
  variants: Array<{ headline: string; note: string }>;
}

const SUMMARY_RULES: SummaryRule[] = [
  {
    cue: "streak",
    when: (stats) => stats.streakDays >= 30,
    variants: [
      {
        headline: "A serious learning habit",
        note: "Thirty days of practice is no accident. Keep today's round short and precise.",
      },
      {
        headline: "Your streak is doing real work",
        note: "This rhythm is making review easier. Protect the streak with one focused set today.",
      },
    ],
  },
  {
    cue: "streak",
    when: (stats) => stats.streakDays >= 7,
    variants: [
      {
        headline: "A full-week learning streak",
        note: "You are turning practice into a habit. Keep today light if you need to, but keep it alive.",
      },
      {
        headline: "Seven days, one steady routine",
        note: "The best move now is consistency: review due cards before chasing lots of new words.",
      },
      {
        headline: "The week is complete",
        note: "Your memory gets stronger when the gaps stay small. A quick review keeps that advantage.",
      },
    ],
  },
  {
    cue: "accuracy",
    when: (stats) => stats.accuracyPct >= 95 && stats.attempts >= 30,
    variants: [
      {
        headline: "Precision mode is on",
        note: "Your accuracy is excellent. Add a few harder reviews to make sure the words hold.",
      },
      {
        headline: "Clean answers, strong control",
        note: "You are missing very little. Try a mixed session to test recall from more angles.",
      },
    ],
  },
  {
    cue: "accuracy",
    when: (stats) => stats.accuracyPct >= 85 && stats.attempts >= 20,
    variants: [
      {
        headline: "Excellent accuracy",
        note: "Your answers are precise. Try a review round to lock these words into long-term memory.",
      },
      {
        headline: "You are answering with confidence",
        note: "This is a good time to combine old due cards with a small batch of new words.",
      },
    ],
  },
  {
    cue: "recovery",
    when: (stats) => stats.attempts >= 15 && stats.accuracyPct < 60,
    variants: [
      {
        headline: "Slow down and rebuild",
        note: "Accuracy is lower right now. Use flashcards first, then return to choices after the words feel familiar.",
      },
      {
        headline: "This set needs a gentler pass",
        note: "A review round is more useful than speed today. Aim for fewer misses, not more cards.",
      },
    ],
  },
  {
    cue: "growth",
    when: (stats) => stats.totalSeen >= 150,
    variants: [
      {
        headline: "A large word bank is forming",
        note: "At this size, review quality matters. Clear due cards before expanding the list again.",
      },
      {
        headline: "You have a real vocabulary base",
        note: "The next gains come from retrieval: mix audio, choices, and sentence work.",
      },
    ],
  },
  {
    cue: "growth",
    when: (stats) => stats.totalSeen >= 50,
    variants: [
      {
        headline: "Your word bank is growing",
        note: "You have covered a lot of ground. Focus on due cards before adding too many new words.",
      },
      {
        headline: "More words are becoming familiar",
        note: "Keep new words small and steady so review does not pile up later.",
      },
    ],
  },
  {
    cue: "review",
    when: (stats) => !stats.practicedToday && stats.streakDays > 0,
    variants: [
      {
        headline: "One quick session keeps it alive",
        note: "You have momentum. A short review today is enough to protect the streak.",
      },
      {
        headline: "Today's card is still waiting",
        note: "Start with due words. If they feel easy, add a small new batch afterward.",
      },
    ],
  },
  {
    cue: "steady",
    when: () => true,
    variants: [
      {
        headline: "Good progress so far",
        note: "A short session today can keep your progress moving without feeling heavy.",
      },
      {
        headline: "Small practice is still practice",
        note: "Pick one lesson, clear a few cards, and stop before it feels noisy.",
      },
      {
        headline: "Keep the pace comfortable",
        note: "You do not need a long session. Accurate recall beats rushing through cards.",
      },
    ],
  },
];

function variantIndex(stats: SummaryContext, variantCount: number): number {
  if (variantCount <= 1) return 0;
  const seed =
    stats.totalSeen * 31 +
    stats.totalCorrect * 17 +
    stats.totalWrong * 13 +
    stats.streakDays * 7 +
    (stats.practicedToday ? 3 : 0);
  return Math.abs(seed) % variantCount;
}
