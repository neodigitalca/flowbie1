import { describe, it, expect } from "vitest";
import {
  buildGbpScheduleOptions,
  gbpScheduledIsoForSlot,
  type GbpScheduleUiState,
} from "@/lib/gbp-post/gbp-schedule-plan";
import { getFirstOfThisMonthDate } from "@/lib/wordpress-scheduler";

function baseState(overrides: Partial<GbpScheduleUiState> = {}): GbpScheduleUiState {
  return {
    numberOfPosts: 4,
    scheduleFrequency: "custom",
    customInterval: 4,
    startDateOption: "custom",
    customStartDate: getFirstOfThisMonthDate("09:00"),
    startTime: "09:00",
    ...overrides,
  };
}

describe("gbpScheduledIsoForSlot", () => {
  it("returns UTC ISO strings ending with Z", () => {
    const iso = gbpScheduledIsoForSlot(baseState(), 2);
    expect(iso).toMatch(/Z$/);
    expect(Number.isFinite(Date.parse(iso))).toBe(true);
  });

  it("slot dates follow generator order", () => {
    const state = baseState({ numberOfPosts: 3 });
    const t0 = Date.parse(gbpScheduledIsoForSlot(state, 0));
    const t1 = Date.parse(gbpScheduledIsoForSlot(state, 1));
    expect(t1).toBeGreaterThan(t0);
  });
});

describe("buildGbpScheduleOptions", () => {
  it("uses custom stagger for times per month", () => {
    const opts = buildGbpScheduleOptions(baseState());
    expect(opts.customStaggerOptimized).toBe(true);
    expect(opts.frequency).toBe("custom");
  });
});
