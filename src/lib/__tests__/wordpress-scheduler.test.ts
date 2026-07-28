import { describe, expect, it } from "vitest";
import {
  calculateScheduledDate,
  dateForPickDatePreset,
  formatSchedulePreview,
  getFirstOfThisMonthDate,
  getNextFirstOfMonthDate,
  isSameLocalCalendarDay,
  isSameUtcYearMonth,
  resolveBulkWordPressPublishDate,
  resolveHybridEffectiveDestination,
  resolveWordPressPostStatusForSchedule,
  OPTIMIZED_STAGGER_WINDOW_MINUTES,
  clampEveryNDays,
} from "../wordpress-scheduler";

const march1 = new Date(Date.UTC(2025, 2, 1, 9, 0, 0, 0));

describe("calculateScheduledDate custom (times per month)", () => {
  const baseOpts = {
    frequency: "custom" as const,
    startDate: march1,
    startTime: "09:00",
    totalRows: 10,
  };

  it("places four posts on distinct UTC days in the first month with the same time when not optimized", () => {
    const opts = {
      ...baseOpts,
      customInterval: 4,
      customStaggerOptimized: false,
    };
    const d0 = calculateScheduledDate(0, opts);
    const d1 = calculateScheduledDate(1, opts);
    const d2 = calculateScheduledDate(2, opts);
    const d3 = calculateScheduledDate(3, opts);
    expect(d0.getUTCDate()).toBe(1);
    expect(d1.getUTCDate()).toBe(9);
    expect(d2.getUTCDate()).toBe(17);
    expect(d3.getUTCDate()).toBe(26);
    expect(d0.getUTCHours()).toBe(9);
    expect(d1.getUTCHours()).toBe(9);
    expect(d2.getUTCHours()).toBe(9);
    expect(d3.getUTCHours()).toBe(9);
  });

  it("uses the same calendar days as non-optimized but staggers UTC hours across the window", () => {
    const opts = {
      ...baseOpts,
      customInterval: 4,
      customStaggerOptimized: true,
    };
    const dates = [0, 1, 2, 3].map((i) => calculateScheduledDate(i, opts));
    const hours = dates.map((d) => d.getUTCHours());
    const minutes = dates.map((d) => d.getUTCMinutes());
    expect(dates[0].getUTCDate()).toBe(1);
    expect(dates[1].getUTCDate()).toBe(9);
    expect(dates[2].getUTCDate()).toBe(17);
    expect(dates[3].getUTCDate()).toBe(26);
    expect(new Set(hours).size).toBe(4);
    expect(hours[0]).toBe(9);
    expect(hours[3]).toBe(17);
    expect(minutes[1]).toBe(40);
  });

  it("moves row 4 to the first slot of the next calendar month", () => {
    const opts = {
      ...baseOpts,
      customInterval: 4,
      customStaggerOptimized: false,
    };
    const d4 = calculateScheduledDate(4, opts);
    expect(d4.getUTCMonth()).toBe(3);
    expect(d4.getUTCDate()).toBe(1);
    expect(d4.getUTCHours()).toBe(9);
  });

  it("applies stagger within the second month independently", () => {
    const opts = {
      ...baseOpts,
      customInterval: 4,
      customStaggerOptimized: true,
    };
    const d4 = calculateScheduledDate(4, opts);
    expect(d4.getUTCMonth()).toBe(3);
    expect(d4.getUTCDate()).toBe(1);
    expect(d4.getUTCHours()).toBe(9);
    const d5 = calculateScheduledDate(5, opts);
    expect(d5.getUTCHours()).toBe(11);
    expect(d5.getUTCMinutes()).toBe(40);
  });

  it("never places the last July slot after the 26th for four times per month from July 1", () => {
    const july1 = new Date(Date.UTC(2026, 6, 1, 12, 0, 0, 0));
    const opts = {
      frequency: "custom" as const,
      startDate: july1,
      startTime: "12:00",
      totalRows: 10,
      customInterval: 4,
      customStaggerOptimized: false,
    };
    for (let i = 0; i < 4; i++) {
      const d = calculateScheduledDate(i, opts);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(6);
      expect(d.getUTCDate()).toBeLessThanOrEqual(26);
    }
  });
});

describe("calculateScheduledDate monthly", () => {
  it("clamps naive +30d dates that fall in the last five days of the month", () => {
    const startDate = new Date(Date.UTC(2026, 0, 1, 10, 30, 0, 0));
    const d1 = calculateScheduledDate(1, {
      frequency: "monthly",
      startDate,
      startTime: "10:30",
      totalRows: 3,
    });
    expect(d1.getUTCMonth()).toBe(0);
    expect(d1.getUTCDate()).toBe(26);
    expect(d1.getUTCHours()).toBe(10);
    expect(d1.getUTCMinutes()).toBe(30);
  });
});

describe("formatSchedulePreview", () => {
  it("describes times per month and optimized stagger", () => {
    const s = formatSchedulePreview({
      frequency: "custom",
      customInterval: 4,
      customStaggerOptimized: true,
      startDate: march1,
      startTime: "09:00",
      totalRows: 3,
    });
    expect(s).toContain("4 times per month");
    expect(s).toContain("staggered");
    expect(s).toContain(`${OPTIMIZED_STAGGER_WINDOW_MINUTES / 60}h`);
  });

  it("handles zero total rows", () => {
    expect(
      formatSchedulePreview({
        frequency: "custom",
        customInterval: 2,
        startDate: march1,
        startTime: "09:00",
        totalRows: 0,
      })
    ).toBe("No posts to schedule");
  });
});

describe("dateForPickDatePreset", () => {
  it("never falls on first-of-this-month or next-first-of-month calendar days", () => {
    const pt = "09:00";
    const d = dateForPickDatePreset(pt);
    const a = getFirstOfThisMonthDate(pt);
    const b = getNextFirstOfMonthDate(pt);
    expect(isSameLocalCalendarDay(d, a)).toBe(false);
    expect(isSameLocalCalendarDay(d, b)).toBe(false);
  });
});

describe("immediately frequency", () => {
  it("schedules every row at the current instant", () => {
    const before = Date.now();
    const d = calculateScheduledDate(3, {
      frequency: "immediately",
      startDate: march1,
      startTime: "09:00",
      totalRows: 10,
    });
    const after = Date.now();
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
    expect(d.getTime()).toBeLessThanOrEqual(after + 50);
  });

  it("ignores CSV publish_date_gmt when frequency is immediately", () => {
    const future = "2099-12-31T09:00:00";
    const before = Date.now();
    const { date, source } = resolveBulkWordPressPublishDate({
      rowPublishDateGmt: future,
      rowIndex: 0,
      schedule: {
        frequency: "immediately",
        startDate: march1,
        startTime: "09:00",
        totalRows: 1,
      },
      useCsvPublishDates: true,
    });
    expect(source).toBe("calculated");
    expect(date.getTime()).toBeGreaterThanOrEqual(before);
    expect(date.getTime()).toBeLessThanOrEqual(Date.now() + 50);
  });

  it("resolves publish status for immediate schedule", () => {
    expect(resolveWordPressPostStatusForSchedule(new Date())).toBe("publish");
  });

  it("describes immediately in formatSchedulePreview", () => {
    const s = formatSchedulePreview({
      frequency: "immediately",
      startDate: march1,
      startTime: "09:00",
      totalRows: 3,
    });
    expect(s).toContain("immediately");
  });
});

describe("everyNDays frequency", () => {
  it("spaces rows by N calendar days from startDate", () => {
    const startDate = new Date(Date.UTC(2026, 3, 10, 14, 0, 0, 0));
    const n = clampEveryNDays(3);
    const d0 = calculateScheduledDate(0, {
      frequency: "everyNDays",
      customInterval: n,
      startDate,
      startTime: "09:00",
      totalRows: 5,
    });
    const d1 = calculateScheduledDate(1, {
      frequency: "everyNDays",
      customInterval: n,
      startDate,
      startTime: "09:00",
      totalRows: 5,
    });
    expect(d1.getTime() - d0.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("describes every N days in formatSchedulePreview", () => {
    const s = formatSchedulePreview({
      frequency: "everyNDays",
      customInterval: 5,
      startDate: march1,
      startTime: "09:00",
      totalRows: 2,
    });
    expect(s).toContain("every 5 days");
  });
});

describe("isSameUtcYearMonth", () => {
  it("returns true for same UTC year and month", () => {
    const a = new Date(Date.UTC(2026, 0, 28, 12, 0, 0));
    const b = new Date(Date.UTC(2026, 0, 1, 8, 0, 0));
    expect(isSameUtcYearMonth(a, b)).toBe(true);
  });

  it("returns false across UTC month boundary", () => {
    const a = new Date(Date.UTC(2026, 0, 31, 23, 0, 0));
    const b = new Date(Date.UTC(2026, 1, 1, 1, 0, 0));
    expect(isSameUtcYearMonth(a, b)).toBe(false);
  });
});

describe("resolveHybridEffectiveDestination", () => {
  const anchor = { year: 2026, month: 0 };

  it("maps wordpress and bank without anchor", () => {
    const d = new Date(Date.UTC(2026, 5, 15, 9, 0, 0));
    expect(resolveHybridEffectiveDestination("wordpress", d, undefined)).toBe("wordpress");
    expect(resolveHybridEffectiveDestination("bank", d, undefined)).toBe("bank");
  });

  it("sends hybrid same UTC month as anchor to wordpress", () => {
    const d = new Date(Date.UTC(2026, 0, 31, 9, 0, 0));
    expect(resolveHybridEffectiveDestination("hybrid", d, anchor)).toBe("wordpress");
  });

  it("sends hybrid later UTC month to bank", () => {
    const d = new Date(Date.UTC(2026, 1, 1, 9, 0, 0));
    expect(resolveHybridEffectiveDestination("hybrid", d, anchor)).toBe("bank");
  });

  it("treats missing anchor as bank for hybrid", () => {
    const d = new Date(Date.UTC(2026, 0, 5, 9, 0, 0));
    expect(resolveHybridEffectiveDestination("hybrid", d, undefined)).toBe("bank");
  });
});

describe("resolveWordPressPostStatusForSchedule", () => {
  it("returns publish when scheduled at or before now", () => {
    const past = new Date(Date.now() - 60_000);
    expect(resolveWordPressPostStatusForSchedule(past)).toBe("publish");
    expect(resolveWordPressPostStatusForSchedule(new Date())).toBe("publish");
  });

  it("returns future when scheduled well ahead", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(resolveWordPressPostStatusForSchedule(future)).toBe("future");
  });
});
