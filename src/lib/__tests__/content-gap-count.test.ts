import { describe, expect, it } from "vitest";
import { contentGapMeasureLabel } from "@/lib/content-gap/content-gap-labels";
import {
  buildGapResult,
  contentGapOutcomeStepLabel,
  ensureContentGapCheckPayload,
  resolveMonthlyCountFromPair,
} from "@/lib/content-gap/resolve-content-gap-count";

describe("resolveMonthlyCountFromPair", () => {
  it("sums scheduled and published for editorial_month", () => {
    expect(resolveMonthlyCountFromPair("editorial_month", 2, 1)).toBe(3);
  });

  it("returns scheduled only for scheduled_month", () => {
    expect(resolveMonthlyCountFromPair("scheduled_month", 2, 1)).toBe(2);
  });

  it("returns published only for posted_month", () => {
    expect(resolveMonthlyCountFromPair("posted_month", 2, 1)).toBe(1);
  });

  it("throws when editorial_month counts are unavailable", () => {
    expect(() => resolveMonthlyCountFromPair("editorial_month", null, 1)).toThrow(
      "Counts are unavailable for this site.",
    );
  });
});

describe("buildGapResult editorial_month", () => {
  it("marks goalMet when combined count meets target", () => {
    const result = buildGapResult({
      source: "posts",
      mode: "editorial_month",
      currentCount: 3,
      targetCount: 3,
      monthLabel: "August 2025",
      scheduledCount: 2,
      publishedCount: 1,
    });

    expect(result.goalMet).toBe(true);
    expect(result.gapCount).toBe(0);
    expect(result.scheduledCount).toBe(2);
    expect(result.publishedCount).toBe(1);
    expect(result.contextText).toContain("Scheduled in month: 2");
    expect(result.contextText).toContain("Posted in month: 1");
    expect(result.contextText).toContain("Current: 3");
  });

  it("reports gap when combined count is below target", () => {
    const result = buildGapResult({
      source: "posts",
      mode: "editorial_month",
      currentCount: 3,
      targetCount: 4,
      monthLabel: "August 2025",
      scheduledCount: 2,
      publishedCount: 1,
    });

    expect(result.goalMet).toBe(false);
    expect(result.gapCount).toBe(1);
    expect(result.statusText).toContain("Create 1 post(s)");
    expect(contentGapOutcomeStepLabel(result)).toBe("Gap found: 1 post");
  });

  it("pluralizes posts in the outcome step label", () => {
    const result = buildGapResult({
      source: "posts",
      mode: "editorial_month",
      currentCount: 1,
      targetCount: 4,
      monthLabel: "August 2025",
      scheduledCount: 0,
      publishedCount: 1,
    });

    expect(contentGapOutcomeStepLabel(result)).toBe("Gap found: 3 posts");
  });

  it("keeps Target met when gap is zero", () => {
    const result = buildGapResult({
      source: "posts",
      mode: "editorial_month",
      currentCount: 4,
      targetCount: 4,
      monthLabel: "August 2025",
      scheduledCount: 2,
      publishedCount: 2,
    });

    expect(contentGapOutcomeStepLabel(result)).toBe("Target met");
  });
});

describe("ensureContentGapCheckPayload", () => {
  it("defaults count mode to editorial_month", () => {
    expect(ensureContentGapCheckPayload({}).contentGapCountMode).toBe("editorial_month");
    expect(ensureContentGapCheckPayload({}).contentGapDayOfMonth).toBe(1);
  });

  it("clamps day of month to 1–31", () => {
    expect(ensureContentGapCheckPayload({ contentGapDayOfMonth: 0 }).contentGapDayOfMonth).toBe(1);
    expect(ensureContentGapCheckPayload({ contentGapDayOfMonth: 14 }).contentGapDayOfMonth).toBe(14);
    expect(ensureContentGapCheckPayload({ contentGapDayOfMonth: 99 }).contentGapDayOfMonth).toBe(31);
  });
});

describe("contentGapMeasureLabel", () => {
  it("labels editorial_month as scheduled or posted in month", () => {
    expect(contentGapMeasureLabel("editorial_month", "posts", "August 2025")).toBe(
      "posts scheduled or posted in August 2025",
    );
  });
});
