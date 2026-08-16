import { useEffect, useRef } from "react";
import { resolveTaskExecuteSiteId } from "@/lib/agent-runs-types";
import {
  ackPendingTaskTrigger,
  fetchPendingTaskTriggers,
  fetchTaskDetail,
} from "@/lib/tasks-api";
import type { TeamTask } from "@/lib/tasks-types";

const POLL_MS = 15_000;

type UsePulseTaskTriggerRunnerArgs = {
  teamId: number | null;
  activeWordPressSiteId: string | null;
  startRunFromTask: (
    task: TeamTask,
    options?: { openSidebar?: boolean },
  ) => Promise<{ ok: boolean; error?: string }>;
  onTriggerRun?: () => void;
};

function taskForTriggerRun(
  task: TeamTask,
  urls: string[],
  activeWordPressSiteId: string | null,
): TeamTask {
  const siteId = resolveTaskExecuteSiteId(task, activeWordPressSiteId);
  return {
    ...task,
    wordpressSiteId: siteId || task.wordpressSiteId,
    executionKind: (task.executionKind?.trim() || "content_optimizer") as TeamTask["executionKind"],
    executionPayload: {
      ...task.executionPayload,
      targetUrls: urls,
    },
  };
}

export function usePulseTaskTriggerRunner({
  teamId,
  activeWordPressSiteId,
  startRunFromTask,
  onTriggerRun,
}: UsePulseTaskTriggerRunnerArgs): void {
  const runningRef = useRef(false);
  const activeSiteRef = useRef(activeWordPressSiteId);
  const startRunRef = useRef(startRunFromTask);
  const onTriggerRunRef = useRef(onTriggerRun);

  activeSiteRef.current = activeWordPressSiteId;
  startRunRef.current = startRunFromTask;
  onTriggerRunRef.current = onTriggerRun;

  useEffect(() => {
    if (!teamId) return;

    const tick = () => {
      if (runningRef.current) return;
      runningRef.current = true;

      void (async () => {
        try {
          const { ok, pending } = await fetchPendingTaskTriggers(teamId);
          if (!ok || !pending?.length) return;

          for (const item of pending) {
            if (!item.taskId || !item.urls?.length) continue;

            const detail = await fetchTaskDetail(teamId, item.taskId);
            const fullTask = detail.task;
            if (!fullTask || fullTask.status === "done") {
              await ackPendingTaskTrigger(teamId, item.taskId);
              continue;
            }
            if (fullTask.scheduleMode !== "trigger") {
              await ackPendingTaskTrigger(teamId, item.taskId);
              continue;
            }

            const result = await startRunRef.current(
              taskForTriggerRun(fullTask, item.urls, activeSiteRef.current),
              { openSidebar: false },
            );
            await ackPendingTaskTrigger(teamId, item.taskId);
            if (result.ok) {
              onTriggerRunRef.current?.();
            }
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
