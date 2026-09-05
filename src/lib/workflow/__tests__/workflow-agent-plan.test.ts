import { describe, expect, it } from "vitest";
import {
  applyWorkflowTriggerBlock,
  hydrateWorkflowAgentPlanFromNodes,
  readWorkflowTriggerBlock,
  stripScheduleFieldsFromAgentPayload,
  syncActionScheduleFromTrigger,
  syncWorkflowAgentScheduleForSave,
} from "@/lib/workflow/workflow-agent-plan";
import type { AutomationPlan } from "@/lib/automation-planner-types";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";

const baseWorkflow: WorkflowDefinition = {
  id: 1,
  teamId: 1,
  name: "Test",
  status: "draft",
  wordpressSiteId: null,
  nodes: [
    {
      id: "client-1",
      kind: "workflow_client",
      label: "Client",
      config: {
        siteIds: ["site_a"],
        frequency: "monthly",
        startDate: "2026-09-01",
        time: "09:00",
      },
      position: { x: 0, y: 0 },
    },
    {
      id: "trigger-1",
      kind: "trigger_calendar",
      label: "Schedule",
      config: {
        frequency: "monthly",
        startDate: "2026-09-01",
        time: "09:00",
      },
      position: { x: 0, y: 0 },
    },
    {
      id: "agent-1",
      kind: "action_agent",
      label: "Post creator",
      config: {
        executionKind: "post_creator",
        executionPayload: {
          scheduleFrequency: "custom",
          scheduleStartDateOption: "custom",
          scheduleCustomStartDate: "2026-08-15",
          scheduleStartTime: "08:30",
          scheduleTimesPerMonth: 4,
          postCount: 4,
        },
      },
      position: { x: 0, y: 140 },
    },
  ],
  edges: [],
  ragVariables: [],
};

const postCreatorRecipe: AutomationRecipeCatalogItem = {
  keyword: "monthly-post-creator",
  name: "Monthly Post Creator",
  description: "",
  isAutomation: true,
  category: "editorial",
  verticals: [],
  tags: [],
  prerequisites: [],
  filters: {},
  defaultTasks: [
    {
      keyword: "monthly-post-creator-run",
      title: "Create scheduled blog posts",
      scheduleMode: "calendar",
      dueDate: "2026-09-01",
      dueTime: "09:00",
      recurrenceRule: "monthly",
      executionKind: "post_creator",
      executionPayload: {
        postCount: 1,
        scheduleStartDateOption: "immediate",
        scheduleStartTime: "09:00",
      },
    },
  ],
  triggerBlock: {
    keyword: "schedule-monthly",
    kind: "calendar",
    frequency: "monthly",
    startDate: "2026-09-01",
    time: "09:00",
  },
};

describe("workflow-agent-plan", () => {
  it("reads calendar publish time from the Client node", () => {
    const trigger = readWorkflowTriggerBlock({
      ...baseWorkflow,
      nodes: [
        {
          id: "client-1",
          kind: "workflow_client",
          label: "Client",
          config: {
            siteIds: ["site_a"],
            frequency: "monthly",
            startDate: "2026-08-01",
            time: "09:01",
          },
          position: { x: 0, y: 0 },
        },
      ],
    });
    expect(trigger?.kind).toBe("calendar");
    if (trigger?.kind === "calendar") {
      expect(trigger.time).toBe("09:01");
      expect(trigger.startDate).toBe("2026-08-01");
    }
  });

  it("persists calendar trigger edits onto workflow node", () => {
    const updated = applyWorkflowTriggerBlock(baseWorkflow, {
      keyword: "schedule-monthly",
      kind: "calendar",
      frequency: "monthly",
      startDate: "2026-08-20",
      time: "08:01",
    });
    const client = updated.nodes.find((node) => node.id === "client-1");
    expect((client?.config as { time?: string }).time).toBe("08:01");
    expect((client?.config as { startDate?: string }).startDate).toBe("2026-08-20");
  });

  it("hydrates saved payload over recipe defaults on reload", () => {
    const plan = hydrateWorkflowAgentPlanFromNodes({
      recipe: postCreatorRecipe,
      workflow: baseWorkflow,
      nodeId: "agent-1",
    });
    expect(plan.action.executionPayload?.scheduleCustomStartDate).toBe("2026-08-15");
    expect(plan.action.executionPayload?.scheduleStartTime).toBe("08:30");
    expect(plan.trigger.kind).toBe("calendar");
    if (plan.trigger.kind === "calendar") {
      expect(plan.trigger.startDate).toBe("2026-09-01");
      expect(plan.trigger.time).toBe("09:00");
    }
  });

  it("stripScheduleFieldsFromAgentPayload removes schedule keys", () => {
    const stripped = stripScheduleFieldsFromAgentPayload({
      scheduleFrequency: "custom",
      scheduleCustomInterval: 2,
      scheduleDayOfWeek: 1,
      scheduleStartDateOption: "custom",
      scheduleCustomStartDate: "2026-08-15",
      scheduleTimesPerMonth: 4,
      scheduleStartDay: 1,
      scheduleStartTime: "08:30",
      scheduleStaggerOptimized: true,
      scheduleDraftOnly: true,
      postDestination: "draft",
      postCount: 4,
    });
    expect(stripped.scheduleFrequency).toBeUndefined();
    expect(stripped.scheduleCustomStartDate).toBeUndefined();
    expect(stripped.scheduleStartTime).toBeUndefined();
    expect(stripped.postCount).toBe(4);
  });

  it("hydrate keeps trigger from workflow when agent payload has custom schedule date", () => {
    const plan = hydrateWorkflowAgentPlanFromNodes({
      recipe: postCreatorRecipe,
      workflow: baseWorkflow,
      nodeId: "agent-1",
    });
    expect(plan.action.executionPayload?.scheduleCustomStartDate).toBe("2026-08-15");
    if (plan.trigger.kind === "calendar") {
      expect(plan.trigger.startDate).toBe("2026-09-01");
      expect(plan.trigger.time).toBe("09:00");
    }
  });

  it("hydrates content optimizer with action block keyword from node config", () => {
    const workflow: WorkflowDefinition = {
      ...baseWorkflow,
      nodes: [
        baseWorkflow.nodes[0],
        {
          id: "agent-opt",
          kind: "action_agent",
          label: "Full AISEO",
          config: {
            executionKind: "content_optimizer",
            actionBlockKeyword: "content-optimizer-full",
            executionPayload: {
              updateMode: "update",
              ragInputKeys: ["dfs_llm_article_audit_1"],
            },
            title: "Full AISEO",
          },
          position: { x: 0, y: 140 },
        },
      ],
      edges: [],
      ragVariables: [],
    };
    const recipe: AutomationRecipeCatalogItem = {
      keyword: "content-optimizer-full",
      name: "Full AISEO",
      description: "",
      isAutomation: true,
      category: "maintenance",
      verticals: [],
      tags: [],
      prerequisites: [],
      filters: {},
      defaultTasks: [],
      triggerBlock: {
        keyword: "schedule-once",
        kind: "calendar",
        frequency: "once",
        startDate: "2026-09-01",
        time: "09:00",
      },
      actionBlock: {
        keyword: "content-optimizer-full",
        executionKind: "content_optimizer",
        executionPayload: { updateMode: "update" },
        title: "Full AISEO",
      },
    };
    const plan = hydrateWorkflowAgentPlanFromNodes({
      recipe,
      workflow,
      nodeId: "agent-opt",
    });
    expect(plan.action.keyword).toBe("content-optimizer-full");
    expect(plan.action.executionKind).toBe("content_optimizer");
    expect(plan.action.executionPayload?.optimizationOptions?.optimizeContent).toBe(true);
    expect(plan.action.executionPayload?.ragInputKeys).toEqual(["dfs_llm_article_audit_1"]);
  });

  it("does not merge downstream Then delivery flags into the agent plan", () => {
    const workflow: WorkflowDefinition = {
      ...baseWorkflow,
      nodes: [
        ...baseWorkflow.nodes,
        {
          id: "then-email",
          kind: "then_email",
          label: "Email",
          config: {
            inputVariableKey: "posts_1",
            inputNodeId: "agent-1",
            executionPayload: {
              sendAutomationEmail: true,
              automationEmailTo: "ops@example.com",
            },
          },
          position: { x: 0, y: 280 },
        },
      ],
      edges: [{ id: "e1", source: "agent-1", target: "then-email" }],
    };
    const plan = hydrateWorkflowAgentPlanFromNodes({
      recipe: postCreatorRecipe,
      workflow,
      nodeId: "agent-1",
    });
    expect(plan.action.executionPayload?.sendAutomationEmail).not.toBe(true);
    expect(String(plan.action.executionPayload?.automationEmailTo ?? "")).toBe("");
  });

  it("save keeps Then-tab custom date when trigger still has recipe default", () => {
    const plan: AutomationPlan = {
      keyword: "monthly-post-creator",
      name: "Posts",
      trigger: {
        keyword: "schedule-monthly",
        kind: "calendar",
        frequency: "monthly",
        startDate: "2026-09-01",
        time: "09:00",
      },
      action: {
        keyword: "post-creator-monthly",
        executionKind: "post_creator",
        executionPayload: {
          scheduleFrequency: "custom",
          scheduleStartDateOption: "custom",
          scheduleCustomStartDate: "2026-08-15",
          scheduleStartTime: "08:30",
          scheduleTimesPerMonth: 4,
          postCount: 4,
        },
        title: "Posts",
      },
    };
    const saved = syncWorkflowAgentScheduleForSave(plan);
    expect(saved.executionPayload.scheduleCustomStartDate).toBe("2026-08-15");
    expect(saved.trigger.kind).toBe("calendar");
    if (saved.trigger.kind === "calendar") {
      expect(saved.trigger.startDate).toBe("2026-08-15");
      expect(saved.trigger.time).toBe("08:30");
    }
  });

  it("syncs payload from When tab when Then tab has no custom date", () => {
    const payload = syncActionScheduleFromTrigger(
      {
        keyword: "schedule-monthly",
        kind: "calendar",
        frequency: "monthly",
        startDate: "2026-08-01",
        time: "09:00",
      },
      {
        scheduleFrequency: "custom",
        scheduleStartDateOption: "immediate",
        scheduleTimesPerMonth: 4,
        scheduleStartTime: "09:00",
      },
      "post_creator",
    );
    expect(payload.scheduleStartDateOption).toBe("custom");
    expect(payload.scheduleCustomStartDate).toBe("2026-08-01");
  });
});
