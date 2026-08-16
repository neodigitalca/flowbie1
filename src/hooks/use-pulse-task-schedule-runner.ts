import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveTaskExecuteSiteId,
  scheduledPulseTaskCanExecute,
} from "@/lib/agent-runs-types";
import {
  edmontonDateKey,
  normalizeTimeKey,
  scheduleDueReadyToRun,
} from "@/lib/edmonton-time";
import { scheduleRunDedupeKey } from "@/lib/automation-schedule-match";
import { fetchCalendarAutomationTasks, fetchPulseAssignedTasks, fetchTaskDetail } from "@/lib/tasks-api";
import { resolveTaskForAutomationExecute } from "@/lib/task-automation-ui";
import { taskHasPulseAssignee } from "@/lib/tasks-filter";
import type { TeamTask } from "@/lib/tasks-types";
import type { TeamMember } from "@/lib/teams-types";

const MATCH_TICK_MS = 1_000;
const REFRESH_TASKS_MS = 15_000;
const STORAGE_PREFIX = "neo-pulse-scheduled-ok:";

function scheduleDueMatchesToday(task: TeamTask, dateKey: string, dueTime: string): boolean {
  if (task.scheduleMode !== "calendar") return false;
  if (!scheduleDueReadyToRun(task, undefined)) return false;
  return Boolean(dueTime);
}

function scheduledRunDedupeKey(taskId: number, task: TeamTask, dateKey: string, time: string): string {
  return `${STORAGE_PREFIX}${taskId}:${scheduleRunDedupeKey(task, dateKey, time)}`;
}

function serverRunDedupeKey(task: TeamTask, dateKey: string, time: string): string {
  return scheduleRunDedupeKey(task, dateKey, time);
}

function alreadySucceeded(task: TeamTask, dateKey: string, time: string): boolean {
  try {
    if (sessionStorage.getItem(scheduledRunDedupeKey(task.id, task, dateKey, time)) === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  const lastRunKey = task.scheduleMeta?.lastRunKey?.trim();
  if (lastRunKey && lastRunKey === serverRunDedupeKey(task, dateKey, time)) {
    return true;
  }
  return false;
}

function markSucceeded(taskId: number, task: TeamTask, dateKey: string, time: string): void {
  try {
    sessionStorage.setItem(scheduledRunDedupeKey(taskId, task, dateKey, time), "1");
  } catch {
    /* ignore */
  }
}

function mergeScheduledTask(existing: TeamTask | undefined, incoming: TeamTask): TeamTask {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    dueTime: incoming.dueTime || existing.dueTime,
    dueDate: incoming.dueDate || existing.dueDate,
    wordpressSiteId: incoming.wordpressSiteId || existing.wordpressSiteId,
    executionKind: incoming.executionKind || existing.executionKind,
    executionPayload: {
      ...existing.executionPayload,
      ...incoming.executionPayload,
    },
    assigneeIds: incoming.assigneeIds?.length ? incoming.assigneeIds : existing.assigneeIds,
  };
}

function taskForScheduledRun(task: TeamTask, activeWordPressSiteId: string | null): TeamTask {
  const resolved = resolveTaskForAutomationExecute(task);
  const siteId = resolveTaskExecuteSiteId(resolved, activeWordPressSiteId);
  const kind = (resolved.executionKind?.trim() || "content_optimizer") as TeamTask["executionKind"];
  return {
    ...resolved,
    wordpressSiteId: siteId || resolved.wordpressSiteId,
    executionKind: kind,
  };
}

type UsePulseTaskScheduleRunnerArgs = {
  teamId: number | null;
  myTasks: TeamTask[];
  members: TeamMember[];
  activeWordPressSiteId: string | null;
  startRunFromTask: (
    task: TeamTask,
    options?: { openSidebar?: boolean },
  ) => Promise<{ ok: boolean; error?: string }>;
  onScheduledRun?: () => void;
};

export function usePulseTaskScheduleRunner({
  teamId,
  myTasks,
  members,
  activeWordPressSiteId,
  startRunFromTask,
  onScheduledRun,
}: UsePulseTaskScheduleRunnerArgs): void {
  const runningRef = useRef(false);
  const activeSiteRef = useRef(activeWordPressSiteId);
  const startRunRef = useRef(startRunFromTask);
  const onScheduledRunRef = useRef(onScheduledRun);
  const [pulseTasks, setPulseTasks] = useState<TeamTask[]>([]);
  const [calendarTasks, setCalendarTasks] = useState<TeamTask[]>([]);

  activeSiteRef.current = activeWordPressSiteId;
  startRunRef.current = startRunFromTask;
  onScheduledRunRef.current = onScheduledRun;

  const scheduledTasks = useMemo(() => {
    const byId = new Map<number, TeamTask>();
    for (const task of calendarTasks) {
      byId.set(task.id, mergeScheduledTask(undefined, task as TeamTask));
    }
    for (const task of pulseTasks) {
      byId.set(task.id, mergeScheduledTask(byId.get(task.id), task as TeamTask));
    }
    for (const task of myTasks) {
      const fromPulseList = byId.has(task.id);
      if (!fromPulseList && !taskHasPulseAssignee(task, members)) continue;
      byId.set(task.id, mergeScheduledTask(byId.get(task.id), task));
    }
    return [...byId.values()].filter((task) => task.scheduleMode === "calendar");
  }, [calendarTasks, pulseTasks, myTasks, members]);

  const scheduledTasksRef = useRef(scheduledTasks);
  scheduledTasksRef.current = scheduledTasks;

  useEffect(() => {
    if (!teamId) {
      setPulseTasks([]);
      setCalendarTasks([]);
      return;
    }
    let cancelled = false;
    const loadCalendar = () => {
      void fetchCalendarAutomationTasks(teamId).then((tasks) => {
        if (!cancelled) setCalendarTasks(tasks as TeamTask[]);
      });
    };
    const loadPulse = () => {
      void fetchPulseAssignedTasks(teamId).then((tasks) => {
        if (!cancelled) setPulseTasks(tasks as TeamTask[]);
      });
    };
    loadCalendar();
    loadPulse();
    const loadId = window.setInterval(() => {
      loadCalendar();
      loadPulse();
    }, REFRESH_TASKS_MS);
    return () => {
      cancelled = true;
      window.clearInterval(loadId);
    };
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;

    const tick = () => {
      if (runningRef.current) return;
      const dateKey = edmontonDateKey();
      const siteId = activeSiteRef.current;

      for (const task of scheduledTasksRef.current) {
        if (task.status === "done") continue;

        const dueDate = (task.dueDate ?? "").slice(0, 10);
        const dueTime = normalizeTimeKey(task.dueTime ?? "");
        if (!dueDate || !dueTime) continue;
        if (!scheduleDueMatchesToday(task, dateKey, dueTime)) continue;
        if (alreadySucceeded(task, dateKey, dueTime)) continue;

        runningRef.current = true;

        void (async () => {
          try {
            const detail = await fetchTaskDetail(teamId, task.id);
            const fullTask = detail.task;
            if (!fullTask || !scheduledPulseTaskCanExecute(fullTask, siteId)) {
              return;
            }
            const result = await startRunRef.current(taskForScheduledRun(fullTask, siteId), {
              openSidebar: false,
            });
            if (result.ok) {
              markSucceeded(task.id, task, dateKey, dueTime);
              onScheduledRunRef.current?.();
            }
          } finally {
            runningRef.current = false;
          }
        })();

        return;
      }
    };

    tick();
    const id = window.setInterval(tick, MATCH_TICK_MS);
    return () => window.clearInterval(id);
  }, [teamId]);
}
