import { describe, expect, it } from "vitest";
import {
  getOverviewBulkActiveRowUrl,
  isBulkDetailsDrawerRowActive,
  isOverviewBulkRunEngaged,
  isOverviewRowBulkActive,
} from "@/components/overview/overview-tab/overview-bulk-run-helpers";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";

function researchBatch(partial: Partial<BulkOptimizationState> = {}): BulkOptimizationState {
  return {
    urls: ["https://example.com/a", "https://example.com/b"],
    currentIndex: 1,
    currentUrl: "https://example.com/b",
    urlStatuses: {
      "https://example.com/a": "completed",
      "https://example.com/b": "pending",
    },
    runKind: "research",
    currentStep: "Researching…",
    ...partial,
  };
}

describe("getOverviewBulkActiveRowUrl research", () => {
  it("returns optimizing url first", () => {
    const batch = researchBatch({
      urlStatuses: {
        "https://example.com/a": "completed",
        "https://example.com/b": "optimizing",
      },
    });
    expect(getOverviewBulkActiveRowUrl(batch, true)).toBe("https://example.com/b");
  });

  it("falls back to currentUrl when between rows", () => {
    const batch = researchBatch({
      currentUrl: "https://example.com/b",
      urlStatuses: {
        "https://example.com/a": "completed",
        "https://example.com/b": "pending",
      },
    });
    expect(getOverviewBulkActiveRowUrl(batch, true)).toBe("https://example.com/b");
  });

  it("falls back to currentIndex url when currentUrl missing", () => {
    const batch = researchBatch({
      currentUrl: undefined,
      currentIndex: 1,
      urlStatuses: {
        "https://example.com/a": "completed",
        "https://example.com/b": "pending",
      },
    });
    expect(getOverviewBulkActiveRowUrl(batch, true)).toBe("https://example.com/b");
  });

  it("returns active url during in-flight research when optimizing flags are off", () => {
    const batch = researchBatch({
      currentUrl: "https://example.com/b",
      urlStatuses: {
        "https://example.com/a": "completed",
        "https://example.com/b": "optimizing",
      },
    });
    expect(getOverviewBulkActiveRowUrl(batch, false)).toBe("https://example.com/b");
  });
});

describe("isOverviewRowBulkActive research", () => {
  it("highlights fallback current row during research", () => {
    const batch = researchBatch({
      currentUrl: "https://example.com/b",
      urlStatuses: {
        "https://example.com/a": "completed",
        "https://example.com/b": "pending",
      },
    });
    expect(isOverviewRowBulkActive("https://example.com/b", batch, true)).toBe(true);
    expect(isOverviewRowBulkActive("https://example.com/a", batch, true)).toBe(false);
  });
});

describe("isOverviewBulkRunEngaged", () => {
  it("is idle when every url is finished", () => {
    const batch = researchBatch({
      urlStatuses: {
        "https://example.com/a": "completed",
        "https://example.com/b": "completed",
      },
      currentStep: "Batch complete",
    });
    expect(isOverviewBulkRunEngaged(batch, "site1-batch", "site1", { "site1-batch": true })).toBe(
      false,
    );
  });
});

describe("isBulkDetailsDrawerRowActive", () => {
  it("matches optimizing url when paginated currentRow is stale", () => {
    expect(
      isBulkDetailsDrawerRowActive(
        "https://example.com/c",
        true,
        4,
        -1,
        { "https://example.com/c": "optimizing" },
      ),
    ).toBe(true);
    expect(
      isBulkDetailsDrawerRowActive(
        "https://example.com/a",
        true,
        0,
        -1,
        { "https://example.com/c": "optimizing" },
      ),
    ).toBe(false);
  });
});
