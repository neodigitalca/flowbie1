import type {
  WorkflowPathBranchConfig,
  WorkflowPathCondition,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";

export type WorkflowPathContext = {
  triggerPayload?: Record<string, unknown>;
  stepOutputs: WorkflowStepOutput[];
  agentResult?: Record<string, unknown>;
  document?: Record<string, unknown>;
};

function outputForKey(outputs: WorkflowStepOutput[], key: string): WorkflowStepOutput | undefined {
  return outputs.find((output) => output.variableKey === key);
}

function compareValues(
  left: string | number | boolean | undefined,
  operator: WorkflowPathCondition["operator"],
  right: string | number | boolean | undefined,
): boolean {
  switch (operator) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return Number(left) > Number(right);
    case "lt":
      return Number(left) < Number(right);
    case "present":
      return left != null && left !== "";
    case "empty":
      return left == null || left === "";
    default:
      return false;
  }
}

function evaluateCondition(condition: WorkflowPathCondition, ctx: WorkflowPathContext): boolean {
  switch (condition.kind) {
    case "gsc_signal": {
      const signal = String(ctx.triggerPayload?.signal ?? "");
      return compareValues(signal, condition.operator ?? "eq", condition.value);
    }
    case "agent_result_field": {
      const field = condition.field ?? "status";
      const value = ctx.agentResult?.[field];
      return compareValues(
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : undefined,
        condition.operator ?? "eq",
        condition.value,
      );
    }
    case "document_source": {
      const source = String(ctx.document?.source ?? ctx.triggerPayload?.source ?? "");
      return compareValues(source, condition.operator ?? "eq", condition.value);
    }
    case "time_window": {
      const hour = new Date().getHours();
      return compareValues(hour, condition.operator ?? "eq", condition.value);
    }
    case "variable_present": {
      const key = condition.variableKey ?? "";
      const output = outputForKey(ctx.stepOutputs, key);
      const text = output?.textPreview ?? "";
      return condition.operator === "empty" ? text.trim() === "" : text.trim() !== "";
    }
    default:
      return false;
  }
}

export function evaluatePathBranch(branch: WorkflowPathBranchConfig, ctx: WorkflowPathContext): boolean {
  if (!branch.conditions.length) return branch.branchId === "default";
  const results = branch.conditions.map((condition) => evaluateCondition(condition, ctx));
  return branch.match === "all" ? results.every(Boolean) : results.some(Boolean);
}

export function pickPathBranchId(
  branches: WorkflowPathBranchConfig[],
  ctx: WorkflowPathContext,
): string {
  for (const branch of branches) {
    if (branch.branchId === "default") continue;
    if (evaluatePathBranch(branch, ctx)) return branch.branchId;
  }
  const fallback = branches.find((branch) => branch.branchId === "default");
  return fallback?.branchId ?? branches[0]?.branchId ?? "default";
}
