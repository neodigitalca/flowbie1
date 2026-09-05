import { describe, expect, it } from "vitest";
import { createWorkflowNode } from "@/lib/workflow/workflow-graph-mutations";
import {
  applyScheduleStampToUpstream,
  scheduleHasUpstream,
  syncAdjacentScheduleFromClient,
} from "@/lib/workflow/workflow-schedule-upstream";
import type { WorkflowActionConfig, WorkflowClientConfig, WorkflowDefinition } from "@/lib/workflow/workflow-types";

function chainWorkflow(nodes: ReturnType<typeof createWorkflowNode>[]): WorkflowDefinition {
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `e-${index}`,
    source: node.id,
    target: nodes[index + 1]!.id,
  }));
  return {
    id: 1,
    teamId: 1,
    name: "Stamp",
    status: "draft",
    nodes,
    edges,
    ragVariables: [],
  };
}

describe("applyScheduleStampToUpstream", () => {
  it("copies Schedule When onto the Client publish fields", () => {
    const client = createWorkflowNode("workflow_client", "Client");
    const schedule = createWorkflowNode("trigger_calendar", "Schedule");
    schedule.config = {
      frequency: "monthly",
      startDate: "2026-09-01",
      time: "07:00",
      dayOfMonth: 1,
      startMonthChoice: "next",
    };
    const agent = createWorkflowNode("action_agent", "GSC");
    const stamped = applyScheduleStampToUpstream(chainWorkflow([client, schedule, agent]));
    const nextClient = stamped.nodes.find((node) => node.id === client.id);
    const config = nextClient?.config as WorkflowClientConfig;
    expect(config.startDate).toBe("2026-09-01");
    expect(config.time).toBe("07:00");
    expect(config.dayOfMonth).toBe(1);
  });

  it("copies Schedule When onto the upstream agent payload", () => {
    const client = createWorkflowNode("workflow_client", "Client");
    const agent = createWorkflowNode("action_agent", "Posts");
    agent.config = {
      executionKind: "post_creator",
      executionPayload: { postCount: 4 },
    };
    const schedule = createWorkflowNode("trigger_calendar", "Schedule");
    schedule.config = {
      frequency: "monthly",
      startDate: "2026-10-15",
      time: "08:30",
      dayOfMonth: 15,
    };
    const stamped = applyScheduleStampToUpstream(chainWorkflow([client, agent, schedule]));
    const nextAgent = stamped.nodes.find((node) => node.id === agent.id);
    const payload = (nextAgent?.config as WorkflowActionConfig).executionPayload;
    expect(payload.scheduleStartTime).toBe("08:30");
    expect(payload.scheduleCustomStartDate).toBe("2026-10-15");
    expect(payload.scheduleStartDay).toBe(15);
  });

  it("syncs Client publish fields onto an adjacent Schedule step", () => {
    const client = createWorkflowNode("workflow_client", "Client");
    client.config = {
      siteIds: ["site_a"],
      frequency: "monthly",
      startDate: "2026-09-01",
      time: "07:00",
      dayOfMonth: 1,
    };
    const schedule = createWorkflowNode("trigger_calendar", "Schedule");
    const agent = createWorkflowNode("action_agent", "GSC");
    const synced = syncAdjacentScheduleFromClient(chainWorkflow([client, schedule, agent]));
    const nextSchedule = synced.nodes.find((node) => node.id === schedule.id);
    expect((nextSchedule?.config as { time?: string }).time).toBe("07:00");
    expect((nextSchedule?.config as { startDate?: string }).startDate).toBe("2026-09-01");
  });

  it("reports when Schedule has no upstream step", () => {
    const schedule = createWorkflowNode("trigger_calendar", "Schedule");
    const workflow = chainWorkflow([schedule]);
    expect(scheduleHasUpstream(workflow, schedule.id)).toBe(false);
  });
});
