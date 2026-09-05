import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  persistWorkflowDefinition,
  resetWorkflowSummaryFingerprintCache,
  workflowSummaryFingerprint,
} from "@/lib/workflow/workflow-persist";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";

vi.mock("@/lib/workflow/workflow-compile", () => ({
  compileWorkflowTasks: vi.fn(async (_teamId: number, workflow: WorkflowDefinition) => workflow),
}));

vi.mock("@/lib/workflow/workflow-api", () => ({
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  summarizeWorkflow: vi.fn(),
}));

import { createWorkflow, summarizeWorkflow, updateWorkflow } from "@/lib/workflow/workflow-api";

const baseWorkflow: WorkflowDefinition = {
  id: 12,
  teamId: 1,
  name: "Blog content gap check",
  status: "draft",
  wordpressSiteId: null,
  nodes: [],
  edges: [],
  ragVariables: [],
};

describe("persistWorkflowDefinition summarize wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkflowSummaryFingerprintCache();
  });

  it("stores the AI description from summarize on update", async () => {
    vi.mocked(summarizeWorkflow).mockResolvedValue({
      ok: true,
      description: "Checks who needs posts.\nCreates posts when there is a gap.",
    });
    vi.mocked(updateWorkflow).mockResolvedValue({
      ok: true,
      workflow: {
        ...baseWorkflow,
        description: "Checks who needs posts.\nCreates posts when there is a gap.",
      },
    });

    const result = await persistWorkflowDefinition(1, baseWorkflow, { compile: false });

    expect(result.ok).toBe(true);
    expect(summarizeWorkflow).toHaveBeenCalledOnce();
    expect(updateWorkflow).toHaveBeenCalledWith(
      1,
      12,
      expect.objectContaining({
        description: "Checks who needs posts.\nCreates posts when there is a gap.",
      }),
    );
  });

  it("keeps the existing description when summarize fails", async () => {
    vi.mocked(summarizeWorkflow).mockResolvedValue({
      ok: false,
      error: "OpenRouter down",
    });
    vi.mocked(updateWorkflow).mockResolvedValue({
      ok: true,
      workflow: { ...baseWorkflow, description: "Old blurb line one.\nOld blurb line two." },
    });

    const result = await persistWorkflowDefinition(
      1,
      { ...baseWorkflow, description: "Old blurb line one.\nOld blurb line two." },
      { compile: false },
    );

    expect(result.ok).toBe(true);
    expect(updateWorkflow).toHaveBeenCalledWith(
      1,
      12,
      expect.objectContaining({
        description: "Old blurb line one.\nOld blurb line two.",
      }),
    );
  });

  it("passes summarize description into create", async () => {
    vi.mocked(summarizeWorkflow).mockResolvedValue({
      ok: true,
      description: "Starts from a gap check.\nMakes blog posts for open slots.",
    });
    vi.mocked(createWorkflow).mockResolvedValue({
      ok: true,
      workflow: { ...baseWorkflow, id: 44 },
    });

    const result = await persistWorkflowDefinition(1, { ...baseWorkflow, id: 0 }, { compile: false });

    expect(result.created).toBe(true);
    expect(createWorkflow).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        description: "Starts from a gap check.\nMakes blog posts for open slots.",
      }),
    );
  });

  it("skips summarize when only reporting dates change", async () => {
    vi.mocked(summarizeWorkflow).mockResolvedValue({
      ok: true,
      description: "Pulls Search Console data.\nBuilds a monthly compare report.",
    });
    vi.mocked(updateWorkflow).mockResolvedValue({
      ok: true,
      workflow: { ...baseWorkflow, description: "Pulls Search Console data.\nBuilds a monthly compare report." },
    });

    const withDates: WorkflowDefinition = {
      ...baseWorkflow,
      description: "Pulls Search Console data.\nBuilds a monthly compare report.",
      nodes: [
        {
          id: "gsc-1",
          kind: "action_agent",
          label: "GSC",
          position: { x: 0, y: 0 },
          config: {
            executionKind: "gsc_reporting",
            executionPayload: { gscComparePresetId: "mom" },
          },
        },
      ],
    };
    const onlyDates: WorkflowDefinition = {
      ...withDates,
      nodes: [
        {
          ...withDates.nodes[0]!,
          config: {
            executionKind: "gsc_reporting",
            executionPayload: { gscComparePresetId: "custom_compare" },
          },
        },
      ],
    };

    expect(workflowSummaryFingerprint(withDates)).toBe(workflowSummaryFingerprint(onlyDates));

    await persistWorkflowDefinition(1, withDates, { compile: false });
    await persistWorkflowDefinition(1, onlyDates, { compile: false });

    expect(summarizeWorkflow).toHaveBeenCalledOnce();
  });

  it("summarizes again when the graph name changes", async () => {
    vi.mocked(summarizeWorkflow).mockResolvedValue({
      ok: true,
      description: "Checks who needs posts.\nCreates posts when there is a gap.",
    });
    vi.mocked(updateWorkflow).mockResolvedValue({ ok: true, workflow: baseWorkflow });

    await persistWorkflowDefinition(1, baseWorkflow, { compile: false });
    await persistWorkflowDefinition(1, { ...baseWorkflow, name: "Renamed workflow" }, { compile: false });

    expect(summarizeWorkflow).toHaveBeenCalledTimes(2);
  });
});
