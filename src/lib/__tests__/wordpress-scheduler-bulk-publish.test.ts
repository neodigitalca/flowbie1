import { buildScheduleOccupancy } from "../bulk-schedule-gap";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  calculateScheduledDate,
  parseBulkCsvPublishDateCell,
  resolveBulkWordPressPublishDate,
  type ScheduleOptions,
} from "../wordpress-scheduler";

const baseSchedule: ScheduleOptions = {
  frequency: "daily",
  startDate: new Date(Date.UTC(2026, 4, 1, 0, 0, 0, 0)),
  startTime: "10:30",
  totalRows: 5,
};

describe("parseBulkCsvPublishDateCell", () => {
  it("parses strict YYYY-MM-DD with start time as UTC wall clock", () => {
    const d = parseBulkCsvPublishDateCell("2026-06-15", "14:00");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-06-15T14:00:00.000Z");
  });

  it("parses full ISO with Z", () => {
    const d = parseBulkCsvPublishDateCell("2026-07-20T08:15:00.000Z", "09:00");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-07-20T08:15:00.000Z");
  });

  it("returns null for empty and garbage", () => {
    expect(parseBulkCsvPublishDateCell("", "09:00")).toBeNull();
    expect(parseBulkCsvPublishDateCell(undefined, "09:00")).toBeNull();
    expect(parseBulkCsvPublishDateCell("   ", "09:00")).toBeNull();
    expect(parseBulkCsvPublishDateCell("not-a-date", "09:00")).toBeNull();
  });
});

describe("resolveBulkWordPressPublishDate", () => {
  it("falls back to calculateScheduledDate when CSV cell missing or invalid", () => {
    const want = calculateScheduledDate(0, baseSchedule);
    for (const rowPublishDateGmt of ["", "nope"]) {
      const r = resolveBulkWordPressPublishDate({
        rowPublishDateGmt,
        rowIndex: 0,
        schedule: baseSchedule,
      });
      expect(r.source).toBe("calculated");
      expect(r.date.getTime()).toBe(want.getTime());
    }
  });

  it("uses CSV when cell is valid ISO", () => {
    const r = resolveBulkWordPressPublishDate({
      rowPublishDateGmt: "2030-01-01T12:00:00.000Z",
      rowIndex: 3,
      schedule: baseSchedule,
    });
    expect(r.source).toBe("csv");
    expect(r.date.toISOString()).toBe("2030-01-01T12:00:00.000Z");
  });

  it("uses CSV for date-only even when rowIndex would shift calculated schedule", () => {
    const r = resolveBulkWordPressPublishDate({
      rowPublishDateGmt: "2028-03-10",
      rowIndex: 9,
      schedule: baseSchedule,
    });
    expect(r.source).toBe("csv");
    expect(r.date.toISOString()).toBe("2028-03-10T10:30:00.000Z");
  });

  it("ignores CSV when useCsvPublishDates is false", () => {
    const want = calculateScheduledDate(0, baseSchedule);
    const r = resolveBulkWordPressPublishDate({
      rowPublishDateGmt: "2030-01-01T12:00:00.000Z",
      rowIndex: 0,
      schedule: baseSchedule,
      useCsvPublishDates: false,
    });
    expect(r.source).toBe("calculated");
    expect(r.date.getTime()).toBe(want.getTime());
  });

  it("uses gap scheduling when occupancy and useGapScheduling are set", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T08:00:00Z"));
    const occ = buildScheduleOccupancy([
      "2026-06-15T09:00:00Z",
      "2026-06-16T09:00:00Z",
      "2026-06-17T09:00:00Z",
    ]);
    const r = resolveBulkWordPressPublishDate({
      rowPublishDateGmt: "",
      rowIndex: 0,
      schedule: {
        ...baseSchedule,
        useGapScheduling: true,
        scheduleOccupancy: occ,
      },
      useCsvPublishDates: false,
    });
    expect(r.source).toBe("calculated");
    expect(r.date.toISOString()).toBe("2026-06-18T10:30:00.000Z");
    vi.useRealTimers();
  });
});
