import { describe, expect, it } from "vitest";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import { buildClientRunContextBlock } from "@/lib/workflow/workflow-client-context";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

describe("workflow-client-context", () => {
  const clientSiteIds = ["site-a", "site-b"];

  const outputs: WorkflowStepOutput[] = [
    {
      id: 1,
      runId: 1,
      nodeId: "agent",
      variableKey: `gsc_1${workflowClientVariableSuffix(clientSiteIds, "site-a")}`,
      scope: "run",
      label: "Posh GSC",
      textPreview: "posh outdoors glamping",
      fileRefs: [{ name: "gsc-report-mom-posh-1.md", url: "https://example.com/posh.md" }],
      siteId: "site-a",
      createdAt: "",
    },
    {
      id: 2,
      runId: 1,
      nodeId: "agent",
      variableKey: `gsc_1${workflowClientVariableSuffix(clientSiteIds, "site-b")}`,
      scope: "run",
      label: "Blinds GSC",
      textPreview: "blinds west hunter douglas",
      fileRefs: [{ name: "gsc-report-mom-blinds-2.md", url: "https://example.com/blinds.md" }],
      siteId: "site-b",
      createdAt: "",
    },
  ];

  it("builds context from one client when clientSiteIds is narrowed to a single site", () => {
    const block = buildClientRunContextBlock(outputs, ["gsc_1"], "site-b", ["site-b"]);
    expect(block).toContain("blinds west hunter douglas");
    expect(block).not.toContain("posh outdoors");
  });

  it("builds per-client context in a full multi-client run", () => {
    const blockA = buildClientRunContextBlock(outputs, ["gsc_1"], "site-a", clientSiteIds);
    const blockB = buildClientRunContextBlock(outputs, ["gsc_1"], "site-b", clientSiteIds);
    expect(blockA).toContain("posh outdoors");
    expect(blockA).not.toContain("blinds west");
    expect(blockB).toContain("blinds west");
    expect(blockB).not.toContain("posh outdoors");
  });
});
