import { describe, expect, it } from "vitest";
import type { QuarterEditorialTileStats } from "@/lib/wordpress-api/types";
import {
  QUARTER_EDITORIAL_ENTITIES_GOAL,
  QUARTER_EDITORIAL_POSTS_GOAL,
  QUARTER_GAP_BLOG_ROWS_CAP,
  allocateQuarterGapRunCounts,
  blogCountFromQuarterGap,
  quarterEntitiesTotal,
  quarterPostTotalsReady,
  quarterPostsTotal,
  quarterStatsBelowGoals,
} from "@/lib/quarter-editorial-gap";

function baseStats(over: Partial<QuarterEditorialTileStats>): QuarterEditorialTileStats {
  return {
    quarterLabel: "Q2 2026",
    loading: false,
    postsLive: 5,
    postsScheduled: 0,
    entityLive: 40,
    entityScheduled: 0,
    entityConfigured: true,
    entityCountsAvailable: true,
    ...over,
  };
}

describe("quarter-editorial-gap", () => {
  it("quarterPostTotalsReady is false while loading", () => {
    const s = baseStats({ loading: true, postsLive: 1, postsScheduled: 2 });
    expect(quarterPostTotalsReady(s)).toBe(false);
  });

  it("quarterPostTotalsReady is false when a post leg is null", () => {
    const s = baseStats({ postsScheduled: null });
    expect(quarterPostTotalsReady(s)).toBe(false);
  });

  it("quarterPostsTotal sums live and scheduled", () => {
    const s = baseStats({ postsLive: 4, postsScheduled: 2 });
    expect(quarterPostsTotal(s)).toBe(6);
  });

  it("quarterEntitiesTotal is null when entity counts unavailable", () => {
    const s = baseStats({ entityCountsAvailable: false });
    expect(quarterEntitiesTotal(s)).toBe(null);
  });

  it("quarterStatsBelowGoals when posts under goal", () => {
    const s = baseStats({
      postsLive: 3,
      postsScheduled: 0,
      entityLive: 50,
      entityScheduled: 0,
    });
    expect(quarterStatsBelowGoals(s)).toBe(true);
  });

  it("quarterStatsBelowGoals when entities under goal and posts ok", () => {
    const s = baseStats({
      postsLive: 9,
      postsScheduled: 0,
      entityLive: 20,
      entityScheduled: 0,
    });
    expect(quarterStatsBelowGoals(s)).toBe(true);
  });

  it("not below goals when both meet thresholds", () => {
    const s = baseStats({
      postsLive: 9,
      postsScheduled: 0,
      entityLive: 45,
      entityScheduled: 0,
    });
    expect(quarterStatsBelowGoals(s)).toBe(false);
  });

  it("blogCountFromQuarterGap uses max of shortfalls at least 1", () => {
    const s = baseStats({
      postsLive: 8,
      postsScheduled: 0,
      entityLive: 44,
      entityScheduled: 0,
    });
    expect(QUARTER_EDITORIAL_POSTS_GOAL - 8).toBe(1);
    expect(QUARTER_EDITORIAL_ENTITIES_GOAL - 44).toBe(1);
    expect(blogCountFromQuarterGap(s)).toBe(1);
  });

  it("blogCountFromQuarterGap caps at QUARTER_GAP_BLOG_ROWS_CAP", () => {
    const s = baseStats({
      postsLive: 0,
      postsScheduled: 0,
      entityLive: 0,
      entityScheduled: 0,
    });
    expect(blogCountFromQuarterGap(s)).toBe(QUARTER_GAP_BLOG_ROWS_CAP);
  });

  it("allocateQuarterGapRunCounts posts-only gap", () => {
    const s = baseStats({
      postsLive: 5,
      postsScheduled: 0,
      entityLive: 50,
      entityScheduled: 0,
    });
    expect(allocateQuarterGapRunCounts(s)).toEqual({
      blogRows: QUARTER_EDITORIAL_POSTS_GOAL - 5,
      sapRows: 0,
    });
  });

  it("allocateQuarterGapRunCounts entities-only gap", () => {
    const s = baseStats({
      postsLive: 9,
      postsScheduled: 0,
      entityLive: 43,
      entityScheduled: 0,
    });
    expect(allocateQuarterGapRunCounts(s)).toEqual({
      blogRows: 0,
      sapRows: QUARTER_EDITORIAL_ENTITIES_GOAL - 43,
    });
  });

  it("allocateQuarterGapRunCounts splits cap when both gaps exceed cap", () => {
    const s = baseStats({
      postsLive: 0,
      postsScheduled: 0,
      entityLive: 0,
      entityScheduled: 0,
    });
    const a = allocateQuarterGapRunCounts(s);
    expect(a).not.toBeNull();
    expect(a!.blogRows + a!.sapRows).toBeLessThanOrEqual(QUARTER_GAP_BLOG_ROWS_CAP);
    expect(a!.blogRows).toBeGreaterThan(0);
    expect(a!.sapRows).toBeGreaterThan(0);
  });
});
