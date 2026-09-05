import { describe, expect, it, vi, afterEach } from "vitest";
import {
  calendarStartMonthChoiceFromConfig,
  formatWorkflowStartDate,
  parseWorkflowStartDate,
  startDateWithDayOfMonth,
  startDateWithMonthChoice,
} from "@/lib/workflow/workflow-calendar-start";

describe("workflow calendar start month", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps year-month when only the day changes", () => {
    expect(startDateWithDayOfMonth("2026-09-15", 1)).toBe("2026-09-01");
  });

  it("writes this month or next month onto startDate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T21:00:00.000Z"));
    expect(startDateWithMonthChoice("", 1, "this")).toBe("2026-08-01");
    expect(startDateWithMonthChoice("", 1, "next")).toBe("2026-09-01");
  });

  it("detects next month from startDate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T21:00:00.000Z"));
    expect(calendarStartMonthChoiceFromConfig({ startDate: "2026-09-01" })).toBe("next");
    expect(calendarStartMonthChoiceFromConfig({ startDate: "2026-08-01" })).toBe("this");
  });

  it("keeps Custom when startMonthChoice is stored", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T21:00:00.000Z"));
    expect(
      calendarStartMonthChoiceFromConfig({
        startDate: "2026-08-15",
        startMonthChoice: "custom",
      }),
    ).toBe("custom");
  });

  it("infers Custom when startDate is not this or next month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T21:00:00.000Z"));
    expect(calendarStartMonthChoiceFromConfig({ startDate: "2026-11-03" })).toBe("custom");
  });

  it("parses and formats a local calendar date", () => {
    const date = parseWorkflowStartDate("2026-11-03");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(3);
    expect(formatWorkflowStartDate(date)).toBe("2026-11-03");
  });
});
