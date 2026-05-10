import { bucketByDay } from "@/modules/analytics";
import { describe, expect, it } from "vitest";

function localDate(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

describe("bucketByDay — window shape", () => {
  it("returns exactly `days` cells regardless of input volume", () => {
    const cells = bucketByDay({
      eventTimestamps: [],
      now: localDate(2026, 5, 10),
      days: 7,
    });
    expect(cells).toHaveLength(7);
  });

  it("the last cell is `now`'s local-calendar day", () => {
    const cells = bucketByDay({
      eventTimestamps: [],
      now: localDate(2026, 5, 10, 18),
      days: 3,
    });
    expect(cells[cells.length - 1]?.date).toBe("2026-05-10");
  });

  it("the first cell is now − (days − 1)", () => {
    const cells = bucketByDay({
      eventTimestamps: [],
      now: localDate(2026, 5, 10),
      days: 5,
    });
    expect(cells[0]?.date).toBe("2026-05-06");
  });

  it("days < 1 returns an empty array", () => {
    expect(bucketByDay({ eventTimestamps: [], now: localDate(2026, 1, 1), days: 0 })).toEqual([]);
  });

  it("never skips gaps — empty days are zero cells", () => {
    const cells = bucketByDay({
      eventTimestamps: [localDate(2026, 5, 8), localDate(2026, 5, 10)],
      now: localDate(2026, 5, 10),
      days: 5,
    });
    expect(cells.map((c) => c.count)).toEqual([0, 0, 1, 0, 1]);
  });
});

describe("bucketByDay — counting", () => {
  it("groups multiple events on the same day into a single cell", () => {
    const cells = bucketByDay({
      eventTimestamps: [
        localDate(2026, 5, 10, 8),
        localDate(2026, 5, 10, 12),
        localDate(2026, 5, 10, 17),
      ],
      now: localDate(2026, 5, 10),
      days: 1,
    });
    expect(cells).toHaveLength(1);
    expect(cells[0]?.count).toBe(3);
  });

  it("ignores events outside the window", () => {
    const cells = bucketByDay({
      eventTimestamps: [
        localDate(2025, 12, 1), // way before window
        localDate(2026, 6, 1), // way after window
        localDate(2026, 5, 10),
      ],
      now: localDate(2026, 5, 10),
      days: 7,
    });
    const total = cells.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(1);
  });
});

describe("bucketByDay — intensity scale", () => {
  it("zero-count cells get intensity 0", () => {
    const cells = bucketByDay({
      eventTimestamps: [],
      now: localDate(2026, 5, 10),
      days: 3,
    });
    for (const c of cells) {
      expect(c.intensity).toBe(0);
    }
  });

  it("any non-zero day gets at least intensity 1", () => {
    const cells = bucketByDay({
      eventTimestamps: [localDate(2026, 5, 10)],
      now: localDate(2026, 5, 10),
      days: 3,
    });
    expect(cells[2]?.intensity).toBe(1);
  });

  it("the busiest day in the window saturates at intensity 4", () => {
    const heavy = Array.from({ length: 20 }, () => localDate(2026, 5, 10, 8));
    const cells = bucketByDay({
      eventTimestamps: [...heavy, localDate(2026, 5, 9, 8)],
      now: localDate(2026, 5, 10),
      days: 3,
    });
    expect(cells[2]?.intensity).toBe(4);
    // 1 / 20 = 5% → bucket 1.
    expect(cells[1]?.intensity).toBe(1);
  });

  it("monotone in count for a fixed window max", () => {
    const events = [
      ...Array(8).fill(localDate(2026, 5, 10)),
      ...Array(4).fill(localDate(2026, 5, 9)),
      ...Array(2).fill(localDate(2026, 5, 8)),
      localDate(2026, 5, 7),
    ];
    const cells = bucketByDay({
      eventTimestamps: events,
      now: localDate(2026, 5, 10),
      days: 4,
    });
    const intensities = cells.map((c) => c.intensity);
    // Earlier (lower-count) days have ≤ later (higher-count) days.
    expect(intensities[0]).toBeLessThanOrEqual(intensities[1] ?? 0);
    expect(intensities[1]).toBeLessThanOrEqual(intensities[2] ?? 0);
    expect(intensities[2]).toBeLessThanOrEqual(intensities[3] ?? 0);
    expect(intensities[3]).toBe(4);
  });
});
