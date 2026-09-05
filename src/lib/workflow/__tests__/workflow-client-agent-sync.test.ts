import { describe, expect, it } from "vitest";
import { syncAgentNodesForWorkflowClient } from "@/lib/workflow/workflow-client-agent-sync";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow/workflow-types";

function actionNode(
  id: string,
  executionKind: string,
  executionPayload: Record<string, unknown> = {},
  ragVariableKey?: string,
): WorkflowNode {
  return {
    id,
    kind: "action_agent",
    label: executionKind,
    config: {
      executionKind,
      executionPayload,
      ...(ragVariableKey ? { ragVariableKey } : {}),
    },
  };
}

describe("syncAgentNodesForWorkflowClient", () => {
  it("strips stored business name and wires entity page creator to grid workflow", () => {
    const nodes: WorkflowNode[] = [
      actionNode("ld", "local_dominator_export", { businessName: "Old Client" }, "local_dominator_export_1"),
      actionNode("entity", "entity_page_creator", { locationSource: "wiki", businessName: "Old Client" }, "entity_page_creator_2"),
    ];
    const edges: WorkflowEdge[] = [
      { id: "e1", source: "ld", target: "entity" },
    ];

    const synced = syncAgentNodesForWorkflowClient({ nodes, edges });

    const ld = synced.find((node) => node.id === "ld")?.config as {
      executionPayload?: { businessName?: string };
    };
    const entity = synced.find((node) => node.id === "entity")?.config as {
      executionPayload?: { locationSource?: string; gridInputSource?: string; ragInputKeys?: string[]; businessName?: string };
    };

    expect(ld.executionPayload?.businessName).toBeUndefined();
    expect(entity.executionPayload?.businessName).toBeUndefined();
    expect(entity.executionPayload?.locationSource).toBe("grid");
    expect(entity.executionPayload?.gridInputSource).toBe("workflow");
    expect(entity.executionPayload?.ragInputKeys).toEqual(["local_dominator_export_1"]);
  });
});
