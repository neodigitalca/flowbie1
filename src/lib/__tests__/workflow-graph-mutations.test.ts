import { describe, expect, it } from "vitest";
import {
  createWorkflowNode,
  deleteNode,
  insertNodeAfter,
  linearOrderedNodes,
  rewireLinearChain,
} from "@/lib/workflow/workflow-graph-mutations";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";

function baseWorkflow(): Pick<WorkflowDefinition, "nodes" | "edges" | "ragVariables"> {
  const client = createWorkflowNode("workflow_client", "Client");
  client.config = { siteIds: ["site_a"] };
  return {
    nodes: [
      client,
      { id: "t1", kind: "trigger_manual", label: "Manual", config: {}, position: { x: 120, y: 220 } },
      { id: "a1", kind: "action_agent", label: "Action", config: {}, position: { x: 120, y: 360 } },
      { id: "r1", kind: "rag_archive", label: "Archive", config: {}, position: { x: 120, y: 500 } },
    ],
    edges: [
      { id: "e_c1_t1", source: client.id, target: "t1" },
      { id: "e_t1_a1", source: "t1", target: "a1" },
      { id: "e_a1_r1", source: "a1", target: "r1" },
    ],
    ragVariables: [{ key: "agent_output", nodeId: "a1", scope: "run", label: "Agent output" }],
  };
}

describe("workflow-graph-mutations", () => {
  it("linearOrderedNodes keeps client first", () => {
    const workflow = baseWorkflow();
    const ordered = linearOrderedNodes(workflow);
    expect(ordered[0]?.kind).toBe("workflow_client");
    expect(ordered.map((node) => node.id)).toEqual([
      workflow.nodes[0]!.id,
      "t1",
      "a1",
      "r1",
    ]);
  });

  it("insertNodeAfter rewires edges correctly", () => {
    const workflow = baseWorkflow();
    const inserted = insertNodeAfter(workflow, "a1", {
      id: "a2",
      kind: "action_agent",
      label: "Inserted",
      config: {},
      position: { x: 120, y: 300 },
    });

    const ordered = linearOrderedNodes(inserted);
    expect(ordered.map((node) => node.id)).toEqual([
      workflow.nodes[0]!.id,
      "t1",
      "a1",
      "a2",
      "r1",
    ]);
    expect(rewireLinearChain(inserted.nodes, inserted.edges).map((edge) => edge.target)).toEqual([
      "t1",
      "a1",
      "a2",
      "r1",
    ]);
  });

  it("insertNodeAfter(null) inserts after client when present", () => {
    const workflow = baseWorkflow();
    const trigger = createWorkflowNode("trigger_calendar", "Schedule");
    const inserted = insertNodeAfter(workflow, null, trigger);
    const ordered = linearOrderedNodes(inserted);
    expect(ordered.map((node) => node.id)[0]).toBe(workflow.nodes[0]!.id);
    expect(ordered.map((node) => node.id)[1]).toBe(trigger.id);
  });

  it("deleteNode repairs linear chain", () => {
    const workflow = baseWorkflow();
    const inserted = insertNodeAfter(workflow, "a1", {
      id: "a2",
      kind: "action_agent",
      label: "Inserted",
      config: {},
      position: { x: 120, y: 300 },
    });
    const removed = deleteNode(inserted, "a2");
    expect(removed).not.toBeNull();
    expect(linearOrderedNodes(removed!).map((node) => node.id)).toEqual([
      workflow.nodes[0]!.id,
      "t1",
      "a1",
      "r1",
    ]);
  });

  it("deleteNode removes trigger", () => {
    const workflow = baseWorkflow();
    const removed = deleteNode(workflow, "t1");
    expect(removed).not.toBeNull();
    expect(removed!.nodes.some((node) => node.id === "t1")).toBe(false);
  });

  it("deleteNode rejects client node", () => {
    const workflow = baseWorkflow();
    const removed = deleteNode(workflow, workflow.nodes[0]!.id);
    expect(removed).toBeNull();
  });
});
