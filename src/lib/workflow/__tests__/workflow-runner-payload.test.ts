import { describe, expect, it } from "vitest";
import { mergeExecutionPayloadForSave } from "@/lib/post-creator/post-creator-schedule-payload";
import { stripWorkflowAgentDeliveryPayload } from "@/lib/workflow/workflow-then-utils";

describe("workflow compiled task payload merge", () => {
  it("lets workflow node config override stale compiled task keyword", () => {
    const taskPayload = { businessName: "KWB", keyword: "blinds near me", saveToDisk: true };
    const nodePayload = { keyword: "auto" };

    const merged = mergeExecutionPayloadForSave(taskPayload, nodePayload, {
      workflowContextBlock: "ctx",
    });

    expect(merged.keyword).toBe("auto");
    expect(merged.businessName).toBe("KWB");
    expect(merged.workflowContextBlock).toBe("ctx");
  });
});

describe("stripWorkflowAgentDeliveryPayload", () => {
  it("clears inline delivery and PC download flags for workflow agent runs", () => {
    const stripped = stripWorkflowAgentDeliveryPayload({
      comparePreset: "mom",
      saveToDisk: true,
      saveLocalArchive: true,
      saveToGoogleDrive: true,
      googleDriveFolderId: "folder-1",
    });

    expect(stripped.saveToDisk).toBe(false);
    expect(stripped.saveLocalArchive).toBe(false);
    expect(stripped.saveToGoogleDrive).toBe(false);
    expect(stripped.googleDriveFolderId).toBe("");
    expect(stripped.comparePreset).toBe("mom");
  });
});
