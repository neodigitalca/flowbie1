import { describe, expect, it } from "vitest";
import {
  pendingServerUploadRowIndex,
  serverPostCreatorRowCount,
} from "@/lib/agent-runs/run-server-post-creator-upload";
import type { AgentRun } from "@/lib/agent-runs-types";

function stubRun(checkpoint: Record<string, unknown>): AgentRun {
  return {
    id: 1,
    teamId: 1,
    recipeKey: "post_creator",
    status: "running",
    plan: { executionMode: "server", clientRunContract: { postCount: 2, siteId: "site-1" } },
    result: {
      executionMode: "server",
      checkpoint: { server: checkpoint },
    },
  } as AgentRun;
}

describe("run-server-post-creator-upload", () => {
  it("returns row index when awaiting client upload", () => {
    const run = stubRun({ intraPhase: "awaiting_client_upload", rowIndex: 1 });
    expect(pendingServerUploadRowIndex(run)).toBe(1);
  });

  it("returns null when not awaiting upload", () => {
    const run = stubRun({ intraPhase: "content", rowIndex: 0 });
    expect(pendingServerUploadRowIndex(run)).toBeNull();
  });

  it("reads post count from checklist rows", () => {
    const run = stubRun({
      checklistRows: [{ keyword: "a" }, { keyword: "b" }, { keyword: "c" }],
    });
    expect(serverPostCreatorRowCount(run)).toBe(3);
  });

  it("parses compact server step keys for row index", async () => {
    const { serverPostCreatorRowIndexFromStepKey } = await import(
      "@/lib/agent-runs/run-server-post-creator-upload"
    );
    expect(serverPostCreatorRowIndexFromStepKey("post0content")).toBe(0);
    expect(serverPostCreatorRowIndexFromStepKey("post1keyword")).toBe(1);
    expect(serverPostCreatorRowIndexFromStepKey("post.0.content")).toBe(0);
  });
});
