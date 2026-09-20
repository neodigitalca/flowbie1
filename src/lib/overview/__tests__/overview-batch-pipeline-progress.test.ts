import { describe, expect, it } from "vitest";
import {
  buildKeywordBatchPipelineSteps,
  buildWpUploadBatchPipelineSteps,
  setBatchStepStatus,
  wpUploadBatchStepsAfterProgress,
} from "@/lib/overview/overview-batch-pipeline-progress";

describe("buildKeywordBatchPipelineSteps", () => {
  it("creates one harness row per batch", () => {
    const steps = buildKeywordBatchPipelineSteps(5, 100, 491, "Focus keywords");
    expect(steps).toHaveLength(5);
    expect(steps[0]?.label).toBe("Focus keywords batch 1/5 (100 rows)");
    expect(steps[4]?.label).toBe("Focus keywords batch 5/5 (91 rows)");
    expect(steps.every((s) => s.status === "waiting")).toBe(true);
  });
});

describe("buildWpUploadBatchPipelineSteps", () => {
  it("matches sequential WP post labels", () => {
    const steps = buildWpUploadBatchPipelineSteps(4);
    expect(steps).toHaveLength(4);
    expect(steps[0]?.label).toBe("WP post 1/4");
    expect(steps[3]?.label).toBe("WP post 4/4");
  });
});

describe("wpUploadBatchStepsAfterProgress", () => {
  it("marks the current WP batch running on start", () => {
    const steps = buildWpUploadBatchPipelineSteps(3);
    const started = wpUploadBatchStepsAfterProgress(steps, 1, 3, "start");
    expect(started[0]?.status).toBe("running");
    expect(started[1]?.status).toBe("waiting");
    expect(started[2]?.status).toBe("waiting");
  });

  it("marks completed WP posts done and next running", () => {
    const steps = buildWpUploadBatchPipelineSteps(3);
    const afterFirst = wpUploadBatchStepsAfterProgress(steps, 1, 3);
    expect(afterFirst[0]?.status).toBe("done");
    expect(afterFirst[1]?.status).toBe("running");
    expect(afterFirst[2]?.status).toBe("waiting");
  });

  it("marks all done on final batch", () => {
    const steps = buildWpUploadBatchPipelineSteps(1);
    const done = wpUploadBatchStepsAfterProgress(steps, 1, 1);
    expect(done.every((s) => s.status === "done")).toBe(true);
  });
});

describe("setBatchStepStatus", () => {
  it("marks prior batches done and current batch running", () => {
    const steps = buildKeywordBatchPipelineSteps(3, 10, 25, "Entity keywords");
    const running = setBatchStepStatus(steps, 1, "running");
    expect(running[0]?.status).toBe("done");
    expect(running[1]?.status).toBe("running");
    expect(running[2]?.status).toBe("waiting");
  });
});
