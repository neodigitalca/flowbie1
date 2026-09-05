import { useEffect, useRef } from "react";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import { ackPendingWorkflowTrigger, fetchPendingWorkflowTriggers } from "@/lib/workflow/workflow-api";
import type { WorkflowRunCallbacks } from "@/lib/workflow/workflow-runner";
import { handlePendingWorkflowDispatch } from "@/lib/workflow/workflow-runner";
import { tryContinueWorkflowAfterAgentComplete } from "@/lib/workflow/workflow-ld-continue-watchdog";

const POLL_MS = 5_000;

type UseWorkflowTriggerRunnerArgs = {
  teamId: number | null;
  callbacks: WorkflowRunCallbacks;
  onWorkflowRun?: () => void;
};

export function useWorkflowTriggerRunner({
  teamId,
  callbacks,
  onWorkflowRun,
}: UseWorkflowTriggerRunnerArgs): void {
  const runningRef = useRef(false);
  const callbacksRef = useRef(callbacks);
  const onWorkflowRunRef = useRef(onWorkflowRun);
  callbacksRef.current = callbacks;
  onWorkflowRunRef.current = onWorkflowRun;

  useEffect(() => {
    if (!teamId) return;

    const tick = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      void (async () => {
        try {
          const pending = await fetchPendingWorkflowTriggers(teamId);
          if (!pending.length) return;
          for (const item of pending) {
            if (String(item.triggerKind ?? "") === "workflow_continue") {
              const agentRunId = Number(
                (item.payload as { agentRunId?: number } | undefined)?.agentRunId ?? 0,
              );
              if (agentRunId <= 0) {
                await ackPendingWorkflowTrigger(teamId, item.workflowId);
                onWorkflowRunRef.current?.();
                continue;
              }
              const agentRun = await fetchAgentRun(teamId, agentRunId);
              if (!agentRun) {
                await ackPendingWorkflowTrigger(teamId, item.workflowId);
                onWorkflowRunRef.current?.();
                continue;
              }
              const continued = await tryContinueWorkflowAfterAgentComplete(
                teamId,
                agentRun,
                callbacksRef.current,
              );
              // Leave pending when CSV is not ready yet; watchdog/poll will retry.
              if (continued) {
                await ackPendingWorkflowTrigger(teamId, item.workflowId);
              }
              onWorkflowRunRef.current?.();
              continue;
            }
            await handlePendingWorkflowDispatch(teamId, item.workflowId, item.runId, callbacksRef.current);
            onWorkflowRunRef.current?.();
          }
        } finally {
          runningRef.current = false;
        }
      })();
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [teamId]);
}
