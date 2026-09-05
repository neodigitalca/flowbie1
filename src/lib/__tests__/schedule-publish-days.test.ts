import { describe, expect, it } from "vitest";
import {
  evenSpreadPublishDays,
  lastAllowedPublishDayUtc,
  normalizePublishDays,
  shufflePublishDays,
} from "../schedule-publish-days";

describe("evenSpreadPublishDays", () => {
  it("spreads four March slots onto unique days through the 26th", () => {
    expect(evenSpreadPublishDays(4, lastAllowedPublishDayUtc(2025, 2))).toEqual([1, 9, 17, 26]);
  });

  it("clamps count to unique days in 1..lastAllowed", () => {
    const last = 26;
    const days = evenSpreadPublishDays(31, last);
    expect(days).toHaveLength(last);
    expect(new Set(days).size).toBe(last);
    expect(days[0]).toBe(1);
    expect(days[last - 1]).toBe(last);
  });
});

describe("shufflePublishDays", () => {
  it("returns a sorted unique list whose length matches the times-per-month cap", () => {
    for (let i = 0; i < 20; i += 1) {
      const days = shufflePublishDays(4, 26);
      expect(days).toHaveLength(4);
      expect(new Set(days).size).toBe(4);
      expect([...days].sort((a, b) => a - b)).toEqual(days);
      for (const day of days) {
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(26);
      }
    }
  });
});

describe("normalizePublishDays", () => {
  it("accepts unique days that match times per month", () => {
    expect(normalizePublishDays([3, 10, 20], 3, 26)).toEqual([3, 10, 20]);
  });

  it("returns null when unique days do not match times per month", () => {
    expect(normalizePublishDays([1, 2], 3, 26)).toBeNull();
    expect(normalizePublishDays([1, 1, 2], 3, 26)).toBeNull();
    expect(normalizePublishDays([], 2, 26)).toBeNull();
  });
});
