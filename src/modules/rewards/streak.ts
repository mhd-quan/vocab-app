/**
 * Daily-practice streak math. Pure: no DB, no Date.now() — every clock
 * read is the caller's responsibility so tests can pin "today" cleanly.
 *
 * A "practice day" is any local-calendar day on which the student
 * recorded at least one learning event (correct or wrong, doesn't
 * matter — engagement is what we're rewarding).
 *
 * `currentStreak` counts consecutive days ending at `now`'s date if the
 * student practised today, or ending at `now - 1 day` if they haven't
 * practised today yet (so a streak doesn't reset until midnight rolls
 * over without practice).
 */

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  lastPracticedAt: Date | null;
  practicedToday: boolean;
}

export interface ComputeStreakInput {
  /** Timestamps of any learning events for the student. Order doesn't matter. */
  eventTimestamps: Date[];
  /** "Now" reference; only the local-date portion is used. */
  now: Date;
}

const MS_PER_DAY = 86_400_000;

function dayKey(d: Date): number {
  // Bucket by local-calendar day. Pure integer key (year*10000 + month*100 + day)
  // so downstream sorts and equality work without timezone shenanigans.
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function computeStreak({ eventTimestamps, now }: ComputeStreakInput): StreakStats {
  if (eventTimestamps.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastPracticedAt: null, practicedToday: false };
  }

  // Dedupe by local-day, sort ascending.
  const dayMap = new Map<number, Date>();
  let lastPracticedAt: Date = eventTimestamps[0] as Date;
  for (const ts of eventTimestamps) {
    const key = dayKey(ts);
    if (!dayMap.has(key)) dayMap.set(key, startOfDay(ts));
    if (ts.getTime() > lastPracticedAt.getTime()) lastPracticedAt = ts;
  }
  const days = Array.from(dayMap.values()).sort((a, b) => a.getTime() - b.getTime());

  // Longest streak — single pass through sorted days.
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = days[i - 1] as Date;
    const cur = days[i] as Date;
    const gapDays = Math.round((cur.getTime() - prev.getTime()) / MS_PER_DAY);
    if (gapDays === 1) {
      run += 1;
      if (run > longestStreak) longestStreak = run;
    } else {
      run = 1;
    }
  }

  // Current streak — walk back from "today" (or yesterday if no
  // practice yet today) and count consecutive days.
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const practicedToday = dayMap.has(todayKey);

  let cursor = practicedToday ? today : new Date(today.getTime() - MS_PER_DAY);
  // If they haven't practised today AND yesterday is missing, streak is 0.
  if (!dayMap.has(dayKey(cursor))) {
    return { currentStreak: 0, longestStreak, lastPracticedAt, practicedToday };
  }

  let currentStreak = 0;
  while (dayMap.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }

  return { currentStreak, longestStreak, lastPracticedAt, practicedToday };
}
