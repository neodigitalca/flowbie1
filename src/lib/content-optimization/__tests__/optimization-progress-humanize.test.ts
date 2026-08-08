import { describe, expect, it } from "vitest";
import {
  collapseOptimizationProgressToMilestones,
  formatOptimizationProgressLog,
  formatRawOptimizationProgressLog,
  pickLatestOptimizationStatus,
} from "@/lib/content-optimization/optimization-progress-humanize";
import type { OptimizationProgressState } from "@/hooks/content-optimization/use-optimization-state";

const FULL_RUN: Pick<OptimizationProgressState, "stepId" | "message" | "microLog"> = {
  microLog: [
    { stepId: "load", message: "Loading page and ACF…" },
    { stepId: "plan", message: "Building blueprint…" },
    { stepId: "write", message: "Generating content and meta…" },
    { stepId: "polish", message: "Resolving links…" },
    { stepId: "publish", message: "Uploading to WordPress…" },
    { stepId: "done", message: "Optimization complete in 27s." },
  ],
  stepId: "done",
  message: "Optimization complete in 27s.",
};

describe("optimization-progress-humanize (stepId)", () => {
  it("collapses a full run to pipeline step labels", () => {
    const milestones = collapseOptimizationProgressToMilestones(FULL_RUN);
    expect(milestones.map((m) => m.label)).toEqual([
      "Load",
      "Plan",
      "Write",
      "Polish",
      "Publish",
      "Optimization complete in 27s.",
    ]);
  });

  it("pickLatestOptimizationStatus uses current stepId", () => {
    expect(pickLatestOptimizationStatus(FULL_RUN)).toBe("Optimization complete in 27s.");
    expect(pickLatestOptimizationStatus({ stepId: "write", message: "Drafting FAQ…" })).toBe("Write");
  });

  it("formatOptimizationProgressLog joins milestone labels", () => {
    const log = formatOptimizationProgressLog(FULL_RUN);
    expect(log.split("\n")).toHaveLength(6);
    expect(log).toContain("Write");
  });

  it("formatRawOptimizationProgressLog includes step labels", () => {
    const log = formatRawOptimizationProgressLog(FULL_RUN);
    expect(log).toContain("Load: Loading page and ACF…");
    expect(log).toContain("Publish: Uploading to WordPress…");
  });
});
