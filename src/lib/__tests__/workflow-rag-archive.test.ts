import { describe, expect, it, vi } from "vitest";
import {
  accumulateWorkflowArchiveFileRefs,
  filterWorkflowArchiveFileRefs,
  mergeWorkflowDeliverableFileRefs,
  workflowRunArchiveOutputs,
} from "@/lib/workflow/workflow-rag-archive";
import type { WorkflowNode, WorkflowStepOutput } from "@/lib/workflow/workflow-types";

vi.mock("@/lib/workflow/workflow-api", () => ({
  saveWorkflowStepOutput: vi.fn(async () => ({ ok: true })),
}));

describe("filterWorkflowArchiveFileRefs", () => {
  const files = [
    {
      name: "gsc-report-mom-site-1.md",
      url: "https://example.com/a.md",
      mime: "text/markdown",
    },
    {
      name: "mom-Queries-MoM.csv",
      url: "https://example.com/a.csv",
      mime: "text/csv",
    },
  ];

  it("returns only the final report markdown when scope is final", () => {
    expect(filterWorkflowArchiveFileRefs(files, "final")).toEqual([files[0]]);
  });

  it("returns empty when multiple gsc reports exist without a site slug match", () => {
    const multi = [
      {
        name: "gsc-report-mom-in-the-shade-1.md",
        url: "https://example.com/shade.md",
        mime: "text/markdown",
      },
      {
        name: "gsc-report-mom-acme-2.md",
        url: "https://example.com/acme.md",
        mime: "text/markdown",
      },
    ];
    expect(filterWorkflowArchiveFileRefs(multi, "final")).toEqual([]);
  });

  it("prefers the gsc report that matches the client site slug", () => {
    const multi = [
      {
        name: "gsc-report-mom-in-the-shade-1.md",
        url: "https://example.com/shade.md",
        mime: "text/markdown",
      },
      {
        name: "gsc-report-mom-acme-2.md",
        url: "https://example.com/acme.md",
        mime: "text/markdown",
      },
    ];
    expect(filterWorkflowArchiveFileRefs(multi, "final", "Acme")).toEqual([multi[1]]);
  });

  it("returns all durable files when scope is all", () => {
    expect(filterWorkflowArchiveFileRefs(files, "all")).toEqual(files);
  });

  it("keeps every serp research brief when scope is final", () => {
    const mixed = [
      {
        name: "grid.csv",
        url: "https://example.com/grid.csv",
        mime: "text/csv",
      },
      {
        name: "serp-research-brief-alberta-tax-brackets-sherwood-park.json",
        url: "https://example.com/a.json",
        mime: "application/json",
      },
      {
        name: "serp-research-brief-tax-brackets-canada-sherwood-park.json",
        url: "https://example.com/b.json",
        mime: "application/json",
      },
      {
        name: "serp-research-brief-cra-instalment-reminder-sherwood-park.json",
        url: "https://example.com/c.json",
        mime: "application/json",
      },
    ];
    expect(filterWorkflowArchiveFileRefs(mixed, "final")).toEqual(mixed);
  });
});

describe("workflowRunArchiveOutputs", () => {
  const nodes: WorkflowNode[] = [
    { id: "a1", kind: "action_agent", label: "Agent", config: {}, position: { x: 0, y: 0 } },
    { id: "r1", kind: "rag_archive", label: "Archive", config: {}, position: { x: 0, y: 0 } },
  ];

  const outputs: WorkflowStepOutput[] = [
    {
      id: 1,
      runId: 1,
      nodeId: "a1",
      variableKey: "step_a1",
      scope: "run",
      label: "Agent",
      textPreview: "Done",
      fileRefs: [{ name: "raw.csv", url: "https://example.com/raw.csv" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: 2,
      runId: 1,
      nodeId: "r1",
      variableKey: "step_a1",
      scope: "run",
      label: "Archive",
      textPreview: "Done",
      fileRefs: [{ name: "gsc-report-mom-site-1.md", url: "https://example.com/report.md" }],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("prefers the latest archive step output when present", () => {
    expect(workflowRunArchiveOutputs(outputs, nodes)).toEqual([outputs[1]]);
  });
});

describe("mergeWorkflowDeliverableFileRefs", () => {
  const nodes: WorkflowNode[] = [
    { id: "ld", kind: "action_agent", label: "Grid", config: {}, position: { x: 0, y: 0 } },
    { id: "ep", kind: "action_agent", label: "Entity", config: {}, position: { x: 0, y: 140 } },
    { id: "r1", kind: "rag_archive", label: "Archive", config: {}, position: { x: 0, y: 280 } },
  ];

  it("merges deliverables from every action agent output", () => {
    const outputs: WorkflowStepOutput[] = [
      {
        id: 1,
        runId: 1,
        nodeId: "ld",
        variableKey: "local_dominator_export_1",
        scope: "run",
        label: "Grid",
        textPreview: "CSV",
        fileRefs: [{ name: "grid.csv", url: "https://example.com/grid.csv", mime: "text/csv" }],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        runId: 1,
        nodeId: "ep",
        variableKey: "entity_page_creator_1",
        scope: "run",
        label: "Entity",
        textPreview: "Pages",
        fileRefs: [{ name: "entity-bulk.csv", url: "https://example.com/entity-bulk.csv", mime: "text/csv" }],
        createdAt: "2026-01-01T00:01:00.000Z",
      },
    ];
    expect(mergeWorkflowDeliverableFileRefs(outputs, nodes)).toEqual([
      outputs[0]!.fileRefs![0],
      outputs[1]!.fileRefs![0],
    ]);
  });
});

describe("syncWorkflowRunArchiveDeliverables per client", () => {
  it("scopes final archive to one client csv", async () => {
    const { syncWorkflowRunArchiveDeliverables } = await import("@/lib/workflow/workflow-rag-archive");
    const { saveWorkflowStepOutput } = await import("@/lib/workflow/workflow-api");
    vi.mocked(saveWorkflowStepOutput).mockResolvedValue({
      ok: true,
      output: {
        id: 9,
        runId: 1,
        nodeId: "r1",
        variableKey: "workflow_output__site_a",
        scope: "run",
        label: "Archive",
        textPreview: "1 deliverable",
        fileRefs: [{ name: "a.csv", url: "https://example.com/a.csv" }],
        createdAt: "",
      },
    });

    const nodes: WorkflowNode[] = [
      { id: "ld", kind: "action_agent", label: "Grid", config: {}, position: { x: 0, y: 0 } },
      {
        id: "r1",
        kind: "rag_archive",
        label: "Archive",
        config: { variableKey: "workflow_output", deliverableScope: "final" },
        position: { x: 0, y: 140 },
      },
    ];
    const outputs: WorkflowStepOutput[] = [
      {
        id: 1,
        runId: 1,
        nodeId: "ld",
        variableKey: "local_dominator_export_1__site_a",
        scope: "run",
        label: "A",
        textPreview: "CSV",
        fileRefs: [{ name: "a.csv", url: "https://example.com/a.csv", mime: "text/csv" }],
        siteId: "site-a",
        createdAt: "",
      },
      {
        id: 2,
        runId: 1,
        nodeId: "ld",
        variableKey: "local_dominator_export_1__site_b",
        scope: "run",
        label: "B",
        textPreview: "CSV",
        fileRefs: [{ name: "b.csv", url: "https://example.com/b.csv", mime: "text/csv" }],
        siteId: "site-b",
        createdAt: "",
      },
    ];

    const saved = await syncWorkflowRunArchiveDeliverables({
      teamId: 1,
      workflowId: 1,
      workflowRunId: 1,
      nodes,
      outputs,
      siteId: "site-a",
      clientSiteIds: ["site-a", "site-b"],
    });

    expect(saved?.fileRefs?.[0]?.name).toBe("a.csv");
    expect(saved?.fileRefs?.[0]?.url).toBe("https://example.com/a.csv");
  });
});

describe("accumulateWorkflowArchiveFileRefs", () => {
  const nodes: WorkflowNode[] = [
    { id: "ld", kind: "action_agent", label: "Grid", config: {}, position: { x: 0, y: 0 } },
    { id: "r1", kind: "rag_archive", label: "Archive", config: {}, position: { x: 0, y: 280 } },
  ];

  it("keeps prior archive file refs when adding incremental deliverables", () => {
    const outputs: WorkflowStepOutput[] = [
      {
        id: 1,
        runId: 1,
        nodeId: "ld",
        variableKey: "local_dominator_export_1",
        scope: "run",
        label: "Grid",
        textPreview: "CSV",
        fileRefs: [{ name: "grid.csv", url: "https://example.com/grid.csv", mime: "text/csv" }],
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        runId: 1,
        nodeId: "r1",
        variableKey: "workflow_output",
        scope: "run",
        label: "Archive",
        textPreview: "1 deliverable",
        fileRefs: [{ name: "grid.csv", url: "https://example.com/grid.csv", mime: "text/csv" }],
        createdAt: "2026-01-01T00:00:30.000Z",
      },
    ];
    const next = {
      name: "grid-summary.md",
      url: "https://example.com/grid-summary.md",
      mime: "text/markdown",
    };
    expect(accumulateWorkflowArchiveFileRefs(outputs, nodes, [next])).toEqual([
      outputs[0]!.fileRefs![0],
      next,
    ]);
  });

  it("scopes incremental deliverables to one client in multi-client runs", () => {
    const outputs: WorkflowStepOutput[] = [
      {
        id: 1,
        runId: 1,
        nodeId: "ld",
        variableKey: "gsc_reporting_1__site_a",
        scope: "run",
        label: "A",
        textPreview: "Report",
        fileRefs: [
          {
            name: "gsc-report-mom-site-a-1.md",
            url: "https://example.com/a.md",
            mime: "text/markdown",
          },
        ],
        siteId: "site-a",
        createdAt: "",
      },
      {
        id: 2,
        runId: 1,
        nodeId: "ld",
        variableKey: "gsc_reporting_1__site_b",
        scope: "run",
        label: "B",
        textPreview: "Report",
        fileRefs: [
          {
            name: "gsc-report-mom-site-b-1.md",
            url: "https://example.com/b.md",
            mime: "text/markdown",
          },
        ],
        siteId: "site-b",
        createdAt: "",
      },
    ];
    expect(
      accumulateWorkflowArchiveFileRefs(outputs, nodes, [], "site-b", ["site-a", "site-b"]),
    ).toEqual([outputs[1]!.fileRefs![0]]);
  });
});
