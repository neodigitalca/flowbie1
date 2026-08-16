import React, { useCallback, useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { cn } from "@/lib/utils";
import { TASK_FORM_DIALOG_BUTTON_CLASS } from "@/components/manager/tasks/TaskFormLayout";
import {
  automationExecuteUsesTriggerRun,
  resolveTaskForAutomationExecute,
} from "@/lib/task-automation-ui";
import { executeAutomationTaskTrigger } from "@/lib/tasks-api";
import type { TaskTriggerEvaluateResult } from "@/lib/task-trigger-types";
import type { TaskProject, TeamTask } from "@/lib/tasks-types";

export type AutomationTaskExecuteButtonProps = {
  teamId: number | null;
  taskId: number;
  task?: Pick<
    TeamTask,
    | "id"
    | "scheduleMode"
    | "executionKind"
    | "executionPayload"
    | "wordpressSiteId"
    | "title"
    | "keyword"
    | "projectId"
    | "recurrenceRule"
    | "dueDate"
    | "dueTime"
  > | null;
  project?: Pick<TaskProject, "keyword" | "sourceTemplateKeyword"> | null;
  disabled?: boolean;
  variant?: "button" | "icon";
  className?: string;
  onExecuted?: (result?: TaskTriggerEvaluateResult & { queued?: boolean }) => void;
};

export function AutomationTaskExecuteButton({
  teamId,
  taskId,
  task,
  project = null,
  disabled = false,
  variant = "button",
  className,
  onExecuted,
}: AutomationTaskExecuteButtonProps): React.ReactElement {
  const { startRunFromTask } = useAgentRunsContext();
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = useCallback(async () => {
    if (!teamId || executing) return;
    setExecuting(true);
    setError(null);
    try {
      const taskRow = task ?? ({ id: taskId } as TeamTask);
      const resolved = resolveTaskForAutomationExecute(taskRow as TeamTask, project);
      const usesTrigger = automationExecuteUsesTriggerRun(resolved, project);

      if (usesTrigger) {
        const result = await executeAutomationTaskTrigger(teamId, taskId);
        if (!result.ok) {
          setError(result.error ?? "Execute failed.");
          return;
        }
        onExecuted?.(result);
        return;
      }

      const result = await startRunFromTask(resolved, { openSidebar: true });
      if (!result.ok) {
        setError(result.error ?? "Execute failed.");
        return;
      }
      onExecuted?.();
    } finally {
      setExecuting(false);
    }
  }, [executing, onExecuted, project, startRunFromTask, task, taskId, teamId]);

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          aria-label="Execute automation action"
          disabled={disabled || executing || !teamId}
          onClick={(e) => {
            e.stopPropagation();
            void handleExecute();
          }}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-none text-muted-foreground hover:bg-zinc-800 hover:text-primary disabled:opacity-50",
            className,
          )}
          title={executing ? "Running…" : error ?? "Execute"}
        >
          <Play className="h-4 w-4" />
        </button>
        {error ? <span className="sr-only">{error}</span> : null}
      </>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        className={cn("h-10 bg-[#77AA00] text-base text-black hover:bg-[#77AA00]/90", TASK_FORM_DIALOG_BUTTON_CLASS)}
        disabled={disabled || executing || !teamId}
        onClick={() => void handleExecute()}
      >
        {executing ? "Running…" : "Execute"}
      </Button>
      {error ? <p className="text-base text-red-400">{error}</p> : null}
    </div>
  );
}
