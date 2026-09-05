import { describe, expect, it } from "vitest";
import {
  clientDeliverableOutputs,
  filterWorkflowOutputsForSite,
  groupWorkflowOutputsByClient,
  parseClientSiteIdFromOutput,
} from "@/lib/workflow/workflow-rag-client";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import type { WorkflowNode, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

const nodes: WorkflowNode[] = [
  { id: "ld", kind: "action_agent", label: "Grid", config: {}, position: { x: 0, y: 0 } },
  { id: "r1", kind: "rag_archive", label: "Archive", config: {}, position: { x: 0, y: 140 } },
];

describe("workflow-rag-client", () => {
  const clientSiteIds = ["site-a", "site-b"];

  const outputs: WorkflowStepOutput[] = [
    {
      id: 1,
      runId: 1,
      nodeId: "ld",
      variableKey: "local_dominator_export_1__site_a",
      scope: "run",
      label: "Grid A",
      textPreview: "CSV",
      fileRefs: [{ name: "a.csv", url: "https://example.com/a.csv" }],
      siteId: "site-a",
      createdAt: "",
    },
    {
      id: 2,
      runId: 1,
      nodeId: "ld",
      variableKey: "local_dominator_export_1__site_b",
      scope: "run",
      label: "Grid B",
      textPreview: "CSV",
      fileRefs: [{ name: "b.csv", url: "https://example.com/b.csv" }],
      siteId: "site-b",
      createdAt: "",
    },
  ];

  it("parses site id from output.siteId and variable suffix", () => {
    expect(parseClientSiteIdFromOutput(outputs[0]!, clientSiteIds)).toBe("site-a");
    expect(parseClientSiteIdFromOutput(outputs[1]!, clientSiteIds)).toBe("site-b");
  });

  it("groups outputs by client site", () => {
    const grouped = groupWorkflowOutputsByClient(outputs, clientSiteIds);
    expect(grouped.get("site-a")).toHaveLength(1);
    expect(grouped.get("site-b")).toHaveLength(1);
  });

  it("returns deliverable outputs for one client only", () => {
    const siteA = clientDeliverableOutputs(outputs, nodes, "site-a", clientSiteIds);
    expect(siteA).toHaveLength(1);
    expect(siteA[0]?.fileRefs?.[0]?.name).toBe("a.csv");
  });

  it("filters outputs for one client when clientSiteIds is narrowed to a single site", () => {
    const mixed: WorkflowStepOutput[] = [
      {
        id: 10,
        runId: 1,
        nodeId: "ld",
        variableKey: `gsc_1${workflowClientVariableSuffix(["site-a", "site-b"], "site-a")}`,
        scope: "run",
        label: "GSC A",
        textPreview: "Posh data",
        fileRefs: [],
        siteId: "site-a",
        agentRunId: 1,
        createdAt: "",
      },
      {
        id: 11,
        runId: 1,
        nodeId: "ld",
        variableKey: `gsc_1${workflowClientVariableSuffix(["site-a", "site-b"], "site-b")}`,
        scope: "run",
        label: "GSC B",
        textPreview: "Blinds data",
        fileRefs: [],
        siteId: "site-b",
        agentRunId: 2,
        createdAt: "",
      },
    ];
    const scoped = filterWorkflowOutputsForSite(mixed, "site-b", ["site-b"]);
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.agentRunId).toBe(2);
    expect(scoped[0]?.textPreview).toBe("Blinds data");
  });
});
