import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  newWorkflowDraftScopeKey,
  shouldApplyFetchedWorkflow,
  shouldInitializeNewWorkflowDraft,
} from "@/lib/workflow/workflow-editor-load-guard";
import { persistWorkflowDefinition, resetWorkflowSummaryFingerprintCache } from "@/lib/workflow/workflow-persist";

vi.mock("@/lib/workflow/workflow-compile", () => ({
  compileWorkflowTasks: vi.fn(async (teamId: number, workflow: { id: number }) => workflow),
}));

vi.mock("@/lib/workflow/workflow-api", () => ({
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  summarizeWorkflow: vi.fn(async () => ({
    ok: true,
    description: "Checks who needs posts.\nCreates posts when there is a gap.",
  })),
}));

import { compileWorkflowTasks } from "@/lib/workflow/workflow-compile";
import { createWorkflow, updateWorkflow } from "@/lib/workflow/workflow-api";

const baseWorkflow = {
  id: 12,
  teamId: 1,
  name: "Test workflow",
  status: "draft" as const,
  wordpressSiteId: null,
  nodes: [],
  edges: [],
  ragVariables: [],
};

describe("workflow-editor-load-guard", () => {
  it("does not reset new draft when only defaultSiteId would change scope", () => {
    const teamScope = newWorkflowDraftScopeKey(7);
    expect(
      shouldInitializeNewWorkflowDraft({
        draftScopeKey: teamScope,
        nextScopeKey: teamScope,
      }),
    ).toBe(false);
  });

  it("initializes new draft when team changes", () => {
    expect(
      shouldInitializeNewWorkflowDraft({
        draftScopeKey: newWorkflowDraftScopeKey(1),
        nextScopeKey: newWorkflowDraftScopeKey(2),
      }),
    ).toBe(true);
  });

  it("ignores stale fetch responses", () => {
    expect(
      shouldApplyFetchedWorkflow({
        responseSeq: 1,
        latestLoadSeq: 2,
        isDirty: false,
      }),
    ).toBe(false);
  });

  it("blocks fetch overwrite while local edits are dirty", () => {
    expect(
      shouldApplyFetchedWorkflow({
        responseSeq: 3,
        latestLoadSeq: 3,
        isDirty: true,
      }),
    ).toBe(false);
  });

  it("applies fetch when seq matches and workflow is clean", () => {
    expect(
      shouldApplyFetchedWorkflow({
        responseSeq: 4,
        latestLoadSeq: 4,
        isDirty: false,
      }),
    ).toBe(true);
  });
});

describe("persistWorkflowDefinition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowSummaryFingerprintCache();
  });

  it("returns graph after PATCH when compile step fails", async () => {
    vi.mocked(updateWorkflow)
      .mockResolvedValueOnce({
        ok: true,
        workflow: { ...baseWorkflow, nodes: [{ id: "agent-1", kind: "action_agent" }] as never },
      })
      .mockResolvedValueOnce({ ok: false, error: "Compile PATCH failed" });

    const result = await persistWorkflowDefinition(1, baseWorkflow);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Compile PATCH failed");
    expect(result.workflow?.nodes).toHaveLength(1);
    expect(compileWorkflowTasks).toHaveBeenCalledOnce();
    expect(updateWorkflow).toHaveBeenCalledTimes(2);
  });

  it("creates a workflow when id is zero", async () => {
    vi.mocked(createWorkflow).mockResolvedValue({
      ok: true,
      workflow: { ...baseWorkflow, id: 99 },
    });

    const result = await persistWorkflowDefinition(1, { ...baseWorkflow, id: 0 });

    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.workflow?.id).toBe(99);
    expect(createWorkflow).toHaveBeenCalledOnce();
    expect(updateWorkflow).not.toHaveBeenCalled();
  });
});
