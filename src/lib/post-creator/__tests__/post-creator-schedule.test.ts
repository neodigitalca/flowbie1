import { describe, expect, it, vi } from "vitest";
import { resolveWordPressPostStatusForSchedule } from "@/lib/wordpress-scheduler";
import { postCreatorRunStartDate } from "@/lib/post-creator/post-creator-run-start-date";

describe("postCreatorRunStartDate", () => {
  it("returns a future anchor when startDay in current month is already past", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const anchor = postCreatorRunStartDate(1, "09:00");
      const scheduled = new Date(
        Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 9, 0, 0, 0),
      );
      expect(scheduled.getTime()).toBeGreaterThan(now.getTime());
      expect(resolveWordPressPostStatusForSchedule(scheduled)).toBe("future");
    } finally {
      vi.useRealTimers();
    }
  });
});
