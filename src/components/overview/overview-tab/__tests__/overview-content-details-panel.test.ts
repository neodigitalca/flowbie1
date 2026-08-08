import { describe, expect, it } from "vitest";
import {
  hasOverviewContentDetailsActivity,
  hasSinglePageOptimizationDetailsActivity,
  overviewContentDetailsCanOpen,
} from "@/components/overview/overview-tab/OverviewContentDetailsPanel";
import { buildSinglePageOptimizationSnapshot } from "@/components/overview/OverviewBulkMicroProgress";

describe("overviewContentDetailsCanOpen", () => {
  const site = { id: "1" } as { id: string };

  it("returns false without site", () => {
    expect(overviewContentDetailsCanOpen(null, {}, undefined)).toBe(false);
  });

  it("returns false when only rows exist (no active run)", () => {
    expect(overviewContentDetailsCanOpen(site, {}, undefined)).toBe(false);
  });

  it("returns true when bulk slice is in progress", () => {
    expect(
      overviewContentDetailsCanOpen(site, { scrape: { total: 10, completed: 2 } }, undefined),
    ).toBe(true);
  });

  it("returns false when bulk slice is finished", () => {
    expect(
      overviewContentDetailsCanOpen(site, { scrape: { total: 10, completed: 10 } }, undefined),
    ).toBe(false);
  });

  it("returns true when batch has urls", () => {
    expect(
      overviewContentDetailsCanOpen(
        site,
        {},
        { urls: ["https://example.com/a"], urlStatuses: {} } as never,
      ),
    ).toBe(true);
  });

  it("returns true when single-page optimization is running", () => {
    expect(
      overviewContentDetailsCanOpen(site, {}, undefined, {
        siteId: "1",
        isOptimizingContent: { "1": true },
        optimizationProgress: {},
        optimizationFileManagers: {},
      }),
    ).toBe(true);
  });

  it("returns true when single-page run failed but progress remains", () => {
    expect(
      overviewContentDetailsCanOpen(site, {}, undefined, {
        siteId: "1",
        isOptimizingContent: {},
        optimizationProgress: {
          "1": { step: "Optimization failed", progress: 70, message: "Blueprint failed" },
        },
        optimizationFileManagers: {},
      }),
    ).toBe(true);
  });
});

describe("hasOverviewContentDetailsActivity", () => {
  it("detects active slice vs completed slice", () => {
    expect(hasOverviewContentDetailsActivity({ contentKw: { total: 5, completed: 3 } }, undefined)).toBe(
      true,
    );
    expect(hasOverviewContentDetailsActivity({ contentKw: { total: 5, completed: 5 } }, undefined)).toBe(
      false,
    );
  });
});

describe("hasSinglePageOptimizationDetailsActivity", () => {
  it("detects optimizing flag and artifact files", () => {
    expect(
      hasSinglePageOptimizationDetailsActivity({
        siteId: "1",
        isOptimizingContent: { "1": true },
        optimizationProgress: {},
        optimizationFileManagers: {},
      }),
    ).toBe(true);

    const fileManager = {
      getFileCount: () => 2,
    } as never;

    expect(
      hasSinglePageOptimizationDetailsActivity({
        siteId: "1",
        isOptimizingContent: {},
        optimizationProgress: {},
        optimizationFileManagers: { "1": fileManager },
      }),
    ).toBe(true);
  });
});

describe("buildSinglePageOptimizationSnapshot", () => {
  it("builds header snapshot from optimization progress", () => {
    const snapshot = buildSinglePageOptimizationSnapshot(
      { step: "Blueprint", progress: 75, message: "Generating sections" },
      { isOptimizing: true, pageUrl: "https://example.com/page" },
    );
    expect(snapshot).toMatchObject({
      label: expect.stringContaining("https://example.com/page"),
      progressPct: 75,
      statusMessage: "Building content outline",
    });
  });

  it("returns null when idle with no progress", () => {
    expect(buildSinglePageOptimizationSnapshot(undefined, { isOptimizing: false })).toBeNull();
  });
});
