import { describe, expect, it } from "vitest";
import {
  buildMetaGenerateStepPlan,
  createInitialMetaGenerateProgress,
  mapGranularStepToPhase,
} from "@/lib/ppc/meta-ads-progress-types";

describe("meta-ads-progress-types", () => {
  it("builds collapsed Meta harness phase plan", () => {
    const steps = buildMetaGenerateStepPlan({
      includePrefetch: true,
      includeLoadContext: true,
      includeImageSteps: true,
    });
    expect(steps.map((step) => step.id)).toEqual([
      "read-master-rules",
      "load-context",
      "strategy",
      "copy",
      "creative-plan",
      "image-prompt",
      "image-generate",
    ]);
  });

  it("creates initial progress with waiting steps", () => {
    const progress = createInitialMetaGenerateProgress({
      includePrefetch: false,
      includeLoadContext: false,
      includeImageSteps: true,
    });
    expect(progress.total).toBe(5);
    expect(progress.steps.every((step) => step.status === "waiting")).toBe(true);
  });

  it("omits image steps when includeImageSteps is false", () => {
    const steps = buildMetaGenerateStepPlan({
      includePrefetch: false,
      includeLoadContext: false,
      includeImageSteps: false,
    });
    expect(steps.map((step) => step.id)).toEqual(["strategy", "copy"]);
  });

  it("maps granular steps to visible phases", () => {
    expect(mapGranularStepToPhase("load-gsc-queries")).toBe("load-context");
    expect(mapGranularStepToPhase("creative-brief")).toBe("strategy");
    expect(mapGranularStepToPhase("image-reference")).toBe("creative-plan");
  });
});
