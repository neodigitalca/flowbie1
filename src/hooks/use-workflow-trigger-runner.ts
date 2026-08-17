import { useEffect, useRef } from "react";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import type { StartAgentRunPayload } from "@/lib/agent-runs-types";
import { ackPendingWorkflowTrigger, fetchPendingWorkflowTriggers } from "@/lib/workflow/workflow-api";
import { handlePendingWorkflowDispatch } from "@/lib/workflow/workflow-runner";

const POLL_MS = 15_000;

type UseWorkflowTriggerRunnerArgs = {
  teamId: number | null;
  startRun: (
    payload: StartAgentRunPayload,
    options?: { openSidebar?: boolean },
  ) => Promise<{ ok: boolean; run?: { id: number; status: string; result?: Record<string, unknown> }; error?: string }>;
  onWorkflowRun?: () => void;
};

async function waitForAgentRun(teamId: number, runId: number): Promise<{ status: string; result?: Record<string, unknown> }> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const run = await fetchAgentRun(teamId, runId);
    if (!run) return { status: "failed" };
    if (isAgentRunTerminal(run.status)) {
      return { status: run.status, result: run.result as Record<string, unknown> | undefined };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { status: "failed" };
}

export function useWorkflowTriggerRunner({
  teamId,
  startRun,
  onWorkflowRun,
}: UseWorkflowTriggerRunnerArgs): void {
  const runningRef = useRef(false);
  const startRunRef = useRef(startRun);
  const onWorkflowRunRef = useRef(onWorkflowRun);
  startRunRef.current = startRun;
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
            await handlePendingWorkflowDispatch(teamId, item.workflowId, item.runId, {
              startRun: startRunRef.current,
              waitForAgentRun: (runId) => waitForAgentRun(teamId, runId),
            });
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
