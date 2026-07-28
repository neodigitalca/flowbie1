import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPublishDatesToSapRows } from "@/lib/local-analysis/entity-preview-sap-hydrate";
import {
  calculateScheduledDate,
  getFirstOfThisMonthDate,
  resolveTimesPerMonthAnchorStart,
} from "@/lib/wordpress-scheduler";

describe("resolveTimesPerMonthAnchorStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 15, 0, 0, 0)); // Jul 23, 2026 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps calendar day 1 for first-of-this-month mid-month (never bumps to today)", () => {
    const first = getFirstOfThisMonthDate("09:00");
    expect(first.getDate()).toBe(1);
    expect(first.getMonth()).toBe(6);

    const anchor = resolveTimesPerMonthAnchorStart("custom", first, "09:00");
    expect(anchor.getUTCFullYear()).toBe(2026);
    expect(anchor.getUTCMonth()).toBe(6);
    expect(anchor.getUTCDate()).toBe(1);
    expect(anchor.getUTCHours()).toBe(9);
    expect(anchor.getUTCMinutes()).toBe(0);
  });

  it("uses next month 1st when startDateOption is immediate and this month 1st has passed", () => {
    const anchor = resolveTimesPerMonthAnchorStart(
      "immediate",
      getFirstOfThisMonthDate("09:00"),
      "09:00",
    );
    expect(anchor.getUTCDate()).toBe(1);
    expect(anchor.getUTCMonth()).toBe(7); // August
  });
});

describe("times-per-month from 1st this month", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 23, 15, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("slot 0 is day 1 of the picked month", () => {
    const startDate = resolveTimesPerMonthAnchorStart(
      "custom",
      getFirstOfThisMonthDate("09:00"),
      "09:00",
    );
    const d0 = calculateScheduledDate(0, {
      frequency: "custom",
      customInterval: 15,
      customStaggerOptimized: true,
      startDate,
      startTime: "09:00",
      totalRows: 15,
    });
    expect(d0.getUTCFullYear()).toBe(2026);
    expect(d0.getUTCMonth()).toBe(6);
    expect(d0.getUTCDate()).toBe(1);
  });

  it("15 posts stay in the same calendar month as the start", () => {
    const startDate = resolveTimesPerMonthAnchorStart(
      "custom",
      getFirstOfThisMonthDate("09:00"),
      "09:00",
    );
    const opts = {
      frequency: "custom" as const,
      customInterval: 15,
      customStaggerOptimized: true,
      startDate,
      startTime: "09:00",
      totalRows: 15,
    };
    for (let i = 0; i < 15; i++) {
      const d = calculateScheduledDate(i, opts);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(6);
    }
  });
});

describe("applyPublishDatesToSapRows", () => {
  it("does not invent publish_date_gmt", () => {
    const rows = [
      { keyword: "a", title: "A" },
      { keyword: "b", title: "B", publish_date_gmt: "2026-07-01T09:00:00" },
    ];
    const out = applyPublishDatesToSapRows(rows);
    expect(out[0]?.publish_date_gmt).toBeUndefined();
    expect(out[1]?.publish_date_gmt).toBe("2026-07-01T09:00:00");
    expect(out).toEqual(rows);
  });
});
