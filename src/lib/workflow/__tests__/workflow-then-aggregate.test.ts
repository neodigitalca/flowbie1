import { describe, expect, it } from "vitest";
import {
  collectDeliverableLabels,
  collectDriveLinkItems,
  formatDriveLinksBulletList,
  resolveEffectiveThenConfig,
  resolveThenUpstreamOutputs,
} from "@/lib/workflow/workflow-then-aggregate";
import type { WorkflowNode, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

function output(partial: Partial<WorkflowStepOutput> & Pick<WorkflowStepOutput, "variableKey">): WorkflowStepOutput {
  return {
    id: 1,
    runId: 1,
    nodeId: "a1",
    scope: "run",
    label: partial.label ?? partial.variableKey,
    textPreview: partial.textPreview ?? "Done",
    fileRefs: partial.fileRefs ?? [],
    createdAt: "",
    ...partial,
  };
}

describe("workflow-then-aggregate", () => {
  it("defaults to single input mode", () => {
    expect(resolveEffectiveThenConfig({ inputVariableKey: "step_a1" }).inputMode).toBe("single");
  });

  it("resolves single upstream by exact key", () => {
    const rows = [
      output({ variableKey: "step_a1", nodeId: "a1" }),
      output({ variableKey: "step_a2", nodeId: "a2" }),
    ];
    const resolved = resolveThenUpstreamOutputs(rows, { inputVariableKey: "step_a1", inputNodeId: "a1" });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.variableKey).toBe("step_a1");
  });

  it("prefers agent-backed output when RAG shares the same variable key", () => {
    const rows = [
      output({
        id: 1,
        variableKey: "gsc_reporting_1",
        nodeId: "rag_1",
        agentRunId: null,
        fileRefs: [{ name: "gsc-report-mom-site.md", url: "https://example.test/a.md" }],
      }),
      output({
        id: 2,
        variableKey: "gsc_reporting_1",
        nodeId: "action_1",
        agentRunId: 946,
        fileRefs: [
          { name: "gsc-report-mom-site.md", url: "https://example.test/b.md" },
          { name: "mom-Queries-MoM.csv", url: "https://example.test/q.csv" },
        ],
      }),
    ];
    const resolved = resolveThenUpstreamOutputs(rows, {
      inputVariableKey: "gsc_reporting_1",
      inputMode: "single",
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.agentRunId).toBe(946);
    expect(resolved[0]?.nodeId).toBe("action_1");
  });

  it("resolves all outputs from node with client suffix keys", () => {
    const rows = [
      output({ variableKey: "step_a1__site_a", nodeId: "a1", siteId: "site-a" }),
      output({ variableKey: "step_a1__site_b", nodeId: "a1", siteId: "site-b" }),
    ];
    const resolved = resolveThenUpstreamOutputs(
      rows,
      { inputVariableKey: "step_a1", inputNodeId: "a1", inputMode: "all_from_node", emailBatchScope: "workflow_run" },
      { allSiteIds: ["site-a", "site-b"] },
    );
    expect(resolved).toHaveLength(2);
  });

  it("scopes per client when batch scope is per_client", () => {
    const rows = [
      output({
        variableKey: "step_a1__site_a",
        nodeId: "a1",
        siteId: "site-a",
        deliveryMeta: { googleDriveUrl: "https://drive.google.com/a" },
      }),
      output({
        variableKey: "step_a1__site_b",
        nodeId: "a1",
        siteId: "site-b",
        deliveryMeta: { googleDriveUrl: "https://drive.google.com/b" },
      }),
    ];
    const resolved = resolveThenUpstreamOutputs(
      rows,
      {
        inputVariableKey: "step_a1",
        inputNodeId: "a1",
        inputMode: "all_from_node",
        emailBatchScope: "per_client",
      },
      { siteId: "site-a", allSiteIds: ["site-a", "site-b"] },
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.siteId).toBe("site-a");
  });

  it("collects drive links and formats bullet list", () => {
    const rows = [
      output({
        variableKey: "then_1",
        label: "Post one",
        deliveryMeta: {
          googleDriveUrl: "https://drive.google.com/file/d/1/view",
          googleDriveFileName: "Post one",
        },
      }),
      output({
        variableKey: "then_2",
        fileRefs: [
          {
            name: "Post two",
            url: "https://docs.google.com/document/d/2/edit",
            mime: "application/vnd.google-apps.document",
          },
        ],
      }),
    ];
    const links = collectDriveLinkItems(rows);
    expect(links).toHaveLength(2);
    expect(formatDriveLinksBulletList(links)).toContain("Post one:");
    expect(collectDeliverableLabels(rows)).toContain("Post one");
  });

  it("resolves all deliverables from action nodes", () => {
    const agent: WorkflowNode = {
      id: "a1",
      kind: "action_agent",
      label: "Agent",
      config: { executionKind: "post_creator", executionPayload: {} },
      position: { x: 0, y: 0 },
    };
    const rows = [
      output({ variableKey: "step_a1", nodeId: "a1", label: "Run 1" }),
      output({ variableKey: "then_x", nodeId: "t1", label: "Email" }),
    ];
    const resolved = resolveThenUpstreamOutputs(
      rows,
      { inputVariableKey: "", inputMode: "all_deliverables" },
      { nodes: [agent] },
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.nodeId).toBe("a1");
  });
});
