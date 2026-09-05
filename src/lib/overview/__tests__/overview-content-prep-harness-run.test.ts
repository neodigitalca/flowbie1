import { describe, expect, it, vi } from "vitest";
import {
  buildContentPrepUrlHarnessMap,
  computeContentPrepBatchProgress,
  markContentPrepBatchHarnessSection,
  markContentPrepHarnessSection,
} from "@/lib/overview/overview-content-prep-harness-run";
import { buildWaitingBatchPrepHarnessSections } from "@/lib/overview/overview-content-prep-harness-sections";
import { buildContentOptimizePipelineTitles, buildPredeterminedBlogBodyHarnessTitles, contentOptimizeHarnessSectionIndex } from "@/lib/overview/overview-content-optimize-pipeline";

const INIT_OPTIMIZE_PIPELINE_TITLES = buildContentOptimizePipelineTitles(
  buildPredeterminedBlogBodyHarnessTitles(""),
);
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";

function makeSetters() {
  let batchState: BulkOptimizationState | undefined;
  const setBulkOptimizationState = vi.fn((updater: (prev: Record<string, BulkOptimizationState>) => Record<string, BulkOptimizationState>) => {
    const prev = batchState ? { "site-batch": batchState } : {};
    const next = updater(prev);
    batchState = next["site-batch"];
    return next;
  });
  const setOptimizationProgress = vi.fn();
  return {
    setters: {
      siteId: "site-1",
      batchKey: "site-batch",
      setBulkOptimizationState,
      setOptimizationProgress,
    },
    getBatch: () => batchState,
    seedBatch(urls: string[]) {
      batchState = {
        urls,
        currentIndex: 0,
        urlStatuses: Object.fromEntries(urls.map((u) => [u, "pending" as const])),
        currentStep: "Preparing…",
        batchPrepHarnessSections: buildWaitingBatchPrepHarnessSections(),
        urlHarnessSections: buildContentPrepUrlHarnessMap(urls),
      };
    },
  };
}

describe("overview-content-prep-harness-run batch vs post harness", () => {
  it("batch harness updates batchPrepHarnessSections (Posts + Pages sitemap)", () => {
    const harness = makeSetters();
    harness.seedBatch(["https://example.com/a/"]);

    markContentPrepBatchHarnessSection(0, "start", harness.setters, "Loading posts sitemap…");
    const afterStart = harness.getBatch();
    expect(afterStart?.batchPrepHarnessSections).toHaveLength(2);
    expect(afterStart?.batchPrepHarnessSections?.[0]?.title).toBe("Posts sitemap");
    expect(afterStart?.batchPrepHarnessSections?.[0]?.status).toBe("generating");
    expect(afterStart?.urlHarnessSections?.["https://example.com/a/"]).toHaveLength(
      INIT_OPTIMIZE_PIPELINE_TITLES.length,
    );
  });

  it("post harness updates urlHarnessSections for SERP and checklist steps", () => {
    const harness = makeSetters();
    harness.seedBatch(["https://example.com/a/"]);
    const url = "https://example.com/a/";

    markContentPrepHarnessSection(
      url,
      contentOptimizeHarnessSectionIndex("SERP research brief"),
      "start",
      harness.setters,
    );
    const serpIndex = contentOptimizeHarnessSectionIndex("SERP research brief");
    const checklistIndex = contentOptimizeHarnessSectionIndex("Checklist");
    expect(harness.getBatch()?.urlHarnessSections?.[url]?.[serpIndex]?.status).toBe("generating");
    expect(harness.getBatch()?.urlHarnessSections?.[url]?.[serpIndex]?.title).toBe("SERP research brief");
    expect(harness.getBatch()?.batchPrepHarnessSections?.[0]?.status).toBe("waiting");

    markContentPrepHarnessSection(url, serpIndex, "done", harness.setters);
    markContentPrepHarnessSection(url, checklistIndex, "start", harness.setters);
    expect(harness.getBatch()?.urlHarnessSections?.[url]?.[checklistIndex]?.status).toBe("generating");
    expect(harness.getBatch()?.urlHarnessSections?.[url]?.[checklistIndex]?.title).toBe("Checklist");
  });

  it("computeContentPrepBatchProgress counts batch inventory + per-post steps", () => {
    const batch: BulkOptimizationState = {
      urls: ["https://example.com/a/", "https://example.com/b/"],
      currentIndex: 0,
      urlStatuses: {
        "https://example.com/a/": "completed",
        "https://example.com/b/": "pending",
      },
      currentStep: "Optimizing",
      batchPrepHarnessSections: [
        { sectionIndex: 0, title: "Posts sitemap", status: "done" },
        { sectionIndex: 1, title: "Pages sitemap", status: "done" },
      ],
      urlHarnessSections: {
        "https://example.com/b/": [
          { sectionIndex: 0, title: "SERP research brief", status: "done" },
          { sectionIndex: 1, title: "Checklist", status: "waiting" },
          { sectionIndex: 2, title: "Blueprint", status: "waiting" },
          { sectionIndex: 3, title: "Content HTML", status: "waiting" },
          { sectionIndex: 4, title: "Content Markdown", status: "waiting" },
        ],
      },
    };
    const pct = computeContentPrepBatchProgress(batch);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });
});
