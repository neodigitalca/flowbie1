import {
  createProjectTask,
  createTaskProject,
  updateTask,
} from "@/lib/tasks-api";
import type { WorkflowActionConfig, WorkflowDefinition, WorkflowNode } from "@/lib/workflow/workflow-types";
import { isWorkflowTriggerKind } from "@/lib/workflow/workflow-types";

function actionNodes(workflow: WorkflowDefinition): WorkflowNode[] {
  return workflow.nodes.filter((node) => node.kind === "action_agent");
}

export async function compileWorkflowTasks(
  teamId: number,
  workflow: WorkflowDefinition,
): Promise<WorkflowDefinition> {
  const trigger = workflow.nodes.find((node) => isWorkflowTriggerKind(node.kind));
  const scheduleMode = trigger?.kind === "trigger_calendar" ? "calendar" : "trigger";
  let projectId = (workflow as WorkflowDefinition & { projectId?: number }).projectId;

  if (!projectId) {
    const created = await createTaskProject(teamId, {
      title: `${workflow.name} (workflow runtime)`,
      isAutomation: true,
      automationVisibility: "private",
      wordpressSiteId: workflow.wordpressSiteId ?? null,
    });
    if (!created.project) return workflow;
    projectId = created.project.id;
  }

  const nextNodes = [...workflow.nodes];
  for (const node of actionNodes(workflow)) {
    const config = node.config as WorkflowActionConfig & { compiledTaskId?: number };
    const payload = {
      keyword: `workflow_${workflow.id}_${node.id}`,
      title: config.title ?? node.label,
      scheduleMode: scheduleMode as "calendar" | "trigger",
      executionKind: config.executionKind,
      executionPayload: config.executionPayload,
      wordpressSiteId: workflow.wordpressSiteId ?? undefined,
    };
    if (config.compiledTaskId) {
      await updateTask(teamId, config.compiledTaskId, payload);
      continue;
    }
    const created = await createProjectTask(teamId, projectId, payload);
    if (created.task) {
      const idx = nextNodes.findIndex((item) => item.id === node.id);
      if (idx >= 0) {
        nextNodes[idx] = {
          ...nextNodes[idx],
          config: { ...config, compiledTaskId: created.task.id },
        };
      }
    }
  }

  return { ...workflow, nodes: nextNodes, ...(projectId ? { projectId } : {}) };
}
