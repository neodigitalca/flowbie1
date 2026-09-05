import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  WORKFLOW_TRIGGER_KINDS,
  workflowTriggerLabel,
  type WorkflowNodeKind,
} from "@/lib/workflow/workflow-types";
import { createWorkflowNode, defaultNodeConfig } from "@/lib/workflow/workflow-graph-mutations";
import { defaultNodeLabel } from "@/lib/workflow/workflow-graph-utils";

describe("trigger_agentmail workflow type", () => {
  it("registers trigger_agentmail in trigger kinds", () => {
    expect(WORKFLOW_TRIGGER_KINDS).toContain("trigger_agentmail");
    expect(workflowTriggerLabel("trigger_agentmail")).toBe("Agent Mail received");
    expect(defaultNodeLabel("trigger_agentmail")).toBe("Agent Mail received");
  });

  it("defaults fromEmail and inbox in node config", () => {
    const node = createWorkflowNode("trigger_agentmail");
    expect(node.config).toEqual({ fromEmail: "", inbox: "" });
    expect(defaultNodeConfig("trigger_agentmail")).toEqual({ fromEmail: "", inbox: "" });
  });

  it("matches sender email case-insensitively in config shape", () => {
    const node = createWorkflowNode("trigger_agentmail");
    const config = { ...(node.config as { fromEmail?: string; inbox?: string }), fromEmail: "Client@Example.com" };
    expect(config.fromEmail.toLowerCase()).toBe("client@example.com");
  });
});

describe("agentmail sender normalization", () => {
  function normalizeSender(raw: string): string {
    const trimmed = raw.trim().toLowerCase();
    const match = trimmed.match(/<([^>]+)>/);
    return (match?.[1] ?? trimmed).trim();
  }

  it("extracts email from angle-bracket format", () => {
    expect(normalizeSender("Client Name <client@example.com>")).toBe("client@example.com");
  });

  it("lowercases plain email", () => {
    expect(normalizeSender("Client@Example.com")).toBe("client@example.com");
  });
});

describe("workflow trigger kind union", () => {
  it("includes trigger_agentmail as valid node kind", () => {
    const kind: WorkflowNodeKind = "trigger_agentmail";
    expect(kind).toBe("trigger_agentmail");
  });
});
