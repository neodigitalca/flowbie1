import { describe, expect, it } from "vitest";
import {
  agentRunMatchesWorkflowRun,
  findAgentRunIdInOutputs,
} from "@/lib/workflow/workflow-test-agent-run";
import type { AgentRun } from "@/lib/agent-runs-types";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

describe("agentRunMatchesWorkflowRun", () => {
  it("matches when context workflow ids align", () => {
    const run = {
      context: { workflowId: 14, workflowRunId: 401 },
      plan: {},
    } as AgentRun;
    expect(agentRunMatchesWorkflowRun(run, 14, 401)).toBe(true);
    expect(agentRunMatchesWorkflowRun(run, 14, 402)).toBe(false);
  });

  it("matches plan fields when context is empty", () => {
    const run = {
      context: {},
      plan: { workflowId: 14, workflowRunId: 401 },
    } as AgentRun;
    expect(agentRunMatchesWorkflowRun(run, 14, 401)).toBe(true);
  });
});

describe("findAgentRunIdInOutputs", () => {
  it("returns first output with agentRunId", () => {
    const outputs = [
      { agentRunId: undefined } as WorkflowStepOutput,
      { agentRunId: 99 } as WorkflowStepOutput,
    ];
    expect(findAgentRunIdInOutputs(outputs)).toBe(99);
  });

  it("returns undefined when no agent run on outputs", () => {
    expect(findAgentRunIdInOutputs([])).toBeUndefined();
  });
});
