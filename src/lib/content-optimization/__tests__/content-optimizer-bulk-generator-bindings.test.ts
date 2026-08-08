import { describe, expect, it } from "vitest";
import {
  buildContentOptimizerBulkGeneratorDetailsProps,
  buildContentOptimizerBulkMicroSnapshot,
  contentOptimizerHeaderProgressFromRun,
  contentOptimizerLiveStatus,
  isContentOptimizerBulkRun,
} from "@/lib/content-optimization/content-optimizer-bulk-generator-bindings";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";

const baseBulkState = (): BulkOptimizationState => ({
  urls: ["https://example.com/a", "https://example.com/b"],
  currentIndex: 1,
  currentUrl: "https://example.com/b",
  urlStatuses: {
    "https://example.com/a": "completed",
    "https://example.com/b": "optimizing",
  },
  currentStep: "",
  urlKeywords: {
    "https://example.com/b": "magic show",
  },
});

describe("isContentOptimizerBulkRun", () => {
  it("treats missing runKind as content optimizer", () => {
    expect(isContentOptimizerBulkRun(baseBulkState())).toBe(true);
  });

  it("rejects harness-only run kinds", () => {
    expect(isContentOptimizerBulkRun({ ...baseBulkState(), runKind: "research" })).toBe(false);
  });
});

describe("contentOptimizerLiveStatus", () => {
  it("prefers site progress message over step labels", () => {
    const status = contentOptimizerLiveStatus({
      bulkState: baseBulkState(),
      siteProgress: {
        stepId: "plan",
        subProgress: 0.2,
        step: "Plan",
        progress: 20,
        message: "Running keyword research...",
      },
      batchProgress: {
        stepId: "load",
        subProgress: 0,
        step: "Load",
        progress: 5,
        message: "Processing post 2 of 2…",
      },
    });
    expect(status).toBe("Running keyword research...");
  });
});

describe("contentOptimizerHeaderProgressFromRun", () => {
  it("maps research phase into harness-blended batch header progress", () => {
    const progress = contentOptimizerHeaderProgressFromRun({
      siteId: "site-1",
      batchKey: "site-1-batch",
      bulkState: baseBulkState(),
      siteProgress: {
        stepId: "plan",
        subProgress: 0.1,
        step: "Plan",
        progress: 18,
        message: "Running keyword research...",
      },
      overviewRows: [],
      isOptimizingContent: { "site-1-batch": true },
      optimizationFileManagers: {},
    });
    expect(progress?.phase).toBe("Running keyword research...");
    expect(progress?.total).toBe(2);
    expect(typeof progress?.progressPct).toBe("number");
  });
});

describe("buildContentOptimizerBulkGeneratorDetailsProps", () => {
  it("surfaces live status on drawer props", () => {
    const props = buildContentOptimizerBulkGeneratorDetailsProps(
      {
        siteId: "site-1",
        batchKey: "site-1-batch",
        bulkState: baseBulkState(),
        siteProgress: {
          stepId: "plan",
          subProgress: 0.1,
          step: "Plan",
          progress: 18,
          message: "Running keyword research...",
          harnessSections: [{ sectionIndex: 0, title: "Intro", status: "generating" }],
          harnessPlannedSectionCount: 3,
        },
        overviewRows: [
          {
            url: "https://example.com/b",
            title: "Blind Magic",
            metaDescription: "",
            aiTitle: "",
            aiMeta: "",
            status: "idle",
            focusKeyword: "magic show",
          },
        ],
        isOptimizingContent: { "site-1-batch": true },
        optimizationFileManagers: {},
      },
      true,
    );
    expect(props.status).toBe("Running keyword research...");
    expect(props.currentRow).toBe(1);
    expect(props.totalRows).toBe(2);
    expect(props.displayRows[1]?.destination_url).toBe("https://example.com/b");
    expect(props.harnessSections).toHaveLength(1);
  });
});

describe("buildContentOptimizerBulkMicroSnapshot", () => {
  it("builds micro snapshot with phase status message", () => {
    const snap = buildContentOptimizerBulkMicroSnapshot({
      siteId: "site-1",
      batchKey: "site-1-batch",
      bulkState: baseBulkState(),
      siteProgress: {
        stepId: "plan",
        subProgress: 0.1,
        step: "Plan",
        progress: 18,
        message: "Running keyword research...",
      },
      overviewRows: [],
      isOptimizingContent: { "site-1-batch": true },
      optimizationFileManagers: {},
      siteName: "Blind Magic",
    });
    expect(snap?.statusMessage).toBe("Running keyword research...");
    expect(snap?.label).toContain("Content Optimizer");
    expect(snap?.total).toBe(2);
  });
});
