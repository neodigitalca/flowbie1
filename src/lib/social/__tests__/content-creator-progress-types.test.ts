import { describe, expect, it } from "vitest";
import {
  createInitialContentGenerateProgress,
  mapContentGranularStepToPhase,
  patchContentGenerateGranularStep,
} from "@/lib/social/content-creator-progress-types";

describe("content-creator-progress-types", () => {
  it("maps granular steps to phases", () => {
    expect(mapContentGranularStepToPhase("social-brief")).toBe("social-copy");
    expect(mapContentGranularStepToPhase("fb-instagram-copy")).toBe("social-copy");
    expect(mapContentGranularStepToPhase("linkedin-copy")).toBe("social-copy");
    expect(mapContentGranularStepToPhase("keyword")).toBe("keyword");
  });

  it("patches progress steps", () => {
    let progress = createInitialContentGenerateProgress();
    progress = patchContentGenerateGranularStep(progress, "keyword", "running");
    const keywordStep = progress.steps.find((step) => step.id === "keyword");
    expect(keywordStep?.status).toBe("running");
    expect(progress.activeStepId).toBe("keyword");
  });
});
