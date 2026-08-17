import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTeam } from "@/contexts/TeamContext";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { usePulseTaskScheduleRunner } from "@/hooks/use-pulse-task-schedule-runner";
import { usePulseTaskTriggerRunner } from "@/hooks/use-pulse-task-trigger-runner";
import {
  createAgentRun,
  cancelAgentRun,
  clearAgentRuns,
  fetchAgentRun,
  fetchAgentRuns,
  patchAgentRun,
} from "@/lib/agent-runs-api";
import { buildAgentRunBatchKey } from "@/lib/agent-runs/agent-run-batch-key";
import { flushAllAgentRunCheckpointPatches } from "@/lib/agent-runs/agent-run-checkpoint";
import { agentRunHasResumeProgress } from "@/lib/agent-runs/agent-run-resume";
import { agentRunIsServerExecution } from "@/lib/agent-runs/agent-run-display";
import {
  executeAgentRun,
  filterRunnableRuns,
  hasTerminalRuns,
} from "@/lib/agent-runs/executor";
import { registerAgentRunListPatcher, type AgentRunListPatch } from "@/lib/agent-runs/agent-runs-local-patch";
import { isAgentRunInterrupted } from "@/lib/agent-runs/agent-run-checkpoint";
import type { AgentRun, StartAgentRunPayload } from "@/lib/agent-runs-types";
import { isAgentRunTerminal, resolveTaskExecuteSiteId, taskExecutionKindToRecipe } from "@/lib/agent-runs-types";
import { prepareTaskForAutomationExecute, resolveEffectiveExecutionKind } from "@/lib/task-automation-ui";
import { readCachedExecutionPayload } from "@/lib/forge-automation-plan-cache";
import { mergeExecutionPayloadForSave } from "@/lib/post-creator/post-creator-schedule-payload";
import { writeAgentRunsSidebarOpen } from "@/lib/agent-runs/storage";
import { writeSidebarOpen, writeSidebarPanel, type SidebarPanel } from "@/lib/pulse-assist/storage";
import { startTaskExecution, reopenTaskExecutionForResume } from "@/lib/tasks-api";
import {
  maybeUploadServerPostCreatorRows,
  serverPostCreatorAwaitingUpload,
  tickServerPostCreatorRun,
  warmInventoryForServerPostCreatorRun,
} from "@/lib/agent-runs/run-server-post-creator-upload";
import type { TeamTask } from "@/lib/tasks-types";

type StartRunOptions = {
  openSidebar?: boolean;
};

type AgentRunsContextValue = {
  runs: AgentRun[];
  selectedRunId: number | null;
  selectedRun: AgentRun | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (panel: SidebarPanel) => void;
  openSidebar: (runId?: number) => void;
  selectRun: (runId: number | null) => void;
  refreshRuns: () => Promise<void>;
  patchRunInList: (runId: number, patch: AgentRunListPatch) => void;
  startRun: (
    payload: StartAgentRunPayload,
    options?: StartRunOptions,
  ) => Promise<{ ok: boolean; run?: AgentRun; error?: string }>;
  startRunFromTask: (
    task: TeamTask,
    options?: StartRunOptions,
  ) => Promise<{ ok: boolean; run?: AgentRun; error?: string }>;
  cancelRun: (runId: number) => Promise<void>;
  resumeRun: (runId: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  hasTerminalHistory: boolean;
};

const AgentRunsContext = createContext<AgentRunsContextValue | null>(null);

export function useAgentRunsContext(): AgentRunsContextValue {
  const ctx = useContext(AgentRunsContext);
  if (!ctx) {
    throw new Error("useAgentRunsContext must be used within AgentRunsContextProvider");
  }
  return ctx;
}

type AgentRunsContextProviderProps = {
  children: ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (panel: SidebarPanel) => void;
};

function agentRunListRowStable(existing: AgentRun, incoming: AgentRun): boolean {
  return (
    existing.status === incoming.status &&
    existing.errorMessage === incoming.errorMessage &&
    existing.title === incoming.title &&
    existing.result?.updated === incoming.result?.updated
  );
}

function mergeAgentRunListRow(existing: AgentRun, incoming: AgentRun): AgentRun {
  if (agentRunListRowStable(existing, incoming)) {
    return existing;
  }
  if (!isAgentRunTerminal(existing.status) && existing.status === incoming.status) {
    return {
      ...incoming,
      result: existing.result ?? incoming.result,
      steps:
        (existing.steps?.length ?? 0) >= (incoming.steps?.length ?? 0)
          ? existing.steps
          : incoming.steps,
      errorMessage: existing.errorMessage || incoming.errorMessage,
    };
  }
  return incoming;
}

export function AgentRunsContextProvider({
  children,
  sidebarOpen,
  setSidebarOpen,
  sidebarPanel,
  setSidebarPanel,
}: AgentRunsContextProviderProps) {
  const { activeTeam, myTasks, members, refreshTasksWorkspace } = useTeam();
  const { activeWordPressSiteId } = useActiveWordPressSite();
  const teamId = activeTeam?.id ?? null;

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const executingRef = useRef(false);

  const { sites } = useWordPressSites();

  const refreshRuns = useCallback(async () => {
    if (!teamId) {
      setRuns([]);
      return;
    }
    const list = await fetchAgentRuns(teamId);
    const hydrated = await Promise.all(
      list.map(async (run) => {
        if (
          isAgentRunInterrupted(run) ||
          (!isAgentRunTerminal(run.status) && agentRunIsServerExecution(run))
        ) {
          const detail = await fetchAgentRun(teamId, run.id);
          return detail ?? run;
        }
        return run;
      }),
    );
    setRuns((prev) => {
      const prevById = new Map(prev.map((run) => [run.id, run]));
      const mergedById = new Map<number, AgentRun>();

      for (const incoming of hydrated) {
        const existing = prevById.get(incoming.id);
        mergedById.set(incoming.id, existing ? mergeAgentRunListRow(existing, incoming) : incoming);
      }

      for (const run of prev) {
        if (mergedById.has(run.id)) continue;
        if (isAgentRunTerminal(run.status)) continue;
        mergedById.set(run.id, run);
      }

      return [...mergedById.values()].sort((a, b) => b.id - a.id);
    });
  }, [teamId]);

  const patchRunInList = useCallback(
    (runId: number, patch: AgentRunListPatch) => {
      setRuns((prev) => {
        const idx = prev.findIndex((r) => r.id === runId);
        if (idx < 0) return prev;
        const current = prev[idx];
        const partial = typeof patch === "function" ? patch(current) : patch;
        const next = [...prev];
        next[idx] = { ...current, ...partial };
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    registerAgentRunListPatcher(patchRunInList);
    return () => registerAgentRunListPatcher(null);
  }, [patchRunInList]);

  const openSidebar = useCallback(
    (runId?: number) => {
      setSidebarPanel("agents");
      writeSidebarPanel("agents");
      setSidebarOpen(true);
      writeSidebarOpen(true);
      writeAgentRunsSidebarOpen(true);
      if (runId) setSelectedRunId(runId);
    },
    [setSidebarOpen, setSidebarPanel],
  );

  const startRun = useCallback(
    async (payload: StartAgentRunPayload, options?: StartRunOptions) => {
      const result = await createAgentRun(payload);
      if (result.ok && result.run) {
        const clientBatchKey = buildAgentRunBatchKey(result.run.id);
        const run = { ...result.run, clientBatchKey };
        void patchAgentRun(result.run.teamId, result.run.id, { clientBatchKey });
        setRuns((prev) => {
          const idx = prev.findIndex((r) => r.id === run.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = run;
            return next;
          }
          return [run, ...prev];
        });
        if (options?.openSidebar !== false) {
          openSidebar(result.run.id);
        }
        void tickServerPostCreatorRun(payload.teamId, run, sites).then((latest) => {
          if (latest) patchRunInList(run.id, latest);
        });
      } else {
        void refreshRuns();
      }
      return result;
    },
    [openSidebar, patchRunInList, refreshRuns, sites],
  );

  const startRunFromTask = useCallback(
    async (task: TeamTask, options?: StartRunOptions) => {
      if (!teamId) return { ok: false, error: "No active team" };
      const prepared = prepareTaskForAutomationExecute(task, null, activeWordPressSiteId);
      const kind =
        (prepared.executionKind ?? "").trim() || resolveEffectiveExecutionKind(prepared);
      const recipeKey = taskExecutionKindToRecipe(kind);
      if (!recipeKey) return { ok: false, error: "Task has no execution recipe" };

      const siteId =
        prepared.wordpressSiteId?.trim() || resolveTaskExecuteSiteId(prepared, activeWordPressSiteId);
      if (!siteId) {
        return { ok: false, error: "Set a client on the project." };
      }

      const exec = await startTaskExecution(teamId, prepared.id, {
        executionKind: kind as TeamTask["executionKind"],
        executionPayload: mergeExecutionPayloadForSave(
          prepared.executionPayload,
          readCachedExecutionPayload(prepared.projectId),
        ),
        wordpressSiteId: siteId,
      });
      if (!exec.ok || !exec.execution) {
        return { ok: false, error: exec.error ?? "Could not start task execution" };
      }

      if (exec.execution.status === "completed") {
        return startRun(
          {
            teamId,
            source: "task_manager",
            recipeKey,
            title: prepared.title,
            taskId: prepared.id,
            context: {
              siteId,
              taskKeyword: prepared.keyword,
              taskTitle: prepared.title,
              projectId: prepared.projectId,
            },
            plan: {
              taskExecutionId: exec.execution.id,
              completedOnServer: true,
            },
          },
          options,
        );
      }

      const executionMode =
        exec.execution.executionMode === "server" ? ("server" as const) : undefined;

      return startRun(
        {
          teamId,
          source: "task_manager",
          recipeKey,
          title: prepared.title,
          taskId: prepared.id,
          context: {
            siteId,
            taskKeyword: prepared.keyword,
            taskTitle: prepared.title,
            projectId: prepared.projectId,
          },
          plan: {
            taskExecutionId: exec.execution.id,
            clientRunContract: exec.execution.clientRunContract ?? undefined,
            executionMode,
          },
        },
        options,
      );
    },
    [activeWordPressSiteId, startRun, teamId],
  );

  usePulseTaskScheduleRunner({
    teamId,
    myTasks,
    members,
    activeWordPressSiteId,
    startRunFromTask,
    onScheduledRun: () => {
      void refreshTasksWorkspace();
      void refreshRuns();
    },
  });

  usePulseTaskTriggerRunner({
    teamId,
    activeWordPressSiteId,
    startRunFromTask,
    onTriggerRun: () => {
      void refreshTasksWorkspace();
      void refreshRuns();
    },
  });

  const cancelRun = useCallback(
    async (runId: number) => {
      if (!teamId) return;
      const { cancelAgentRun } = await import("@/lib/agent-runs-api");
      const result = await cancelAgentRun(teamId, runId);
      if (result.ok && result.run) {
        patchRunInList(runId, result.run);
      } else {
        patchRunInList(runId, { status: "cancelled" });
      }
    },
    [patchRunInList, teamId],
  );

  const resumeRun = useCallback(
    async (runId: number) => {
      if (!teamId) return;
      const existing = runs.find((r) => r.id === runId);
      if (existing && agentRunIsServerExecution(existing)) {
        let active = existing;
        if (active.status === "failed" || active.status === "cancelled") {
          const requeued = await patchAgentRun(teamId, runId, {
            status: "running",
            errorMessage: "",
          });
          if (requeued.ok && requeued.run) {
            active = requeued.run;
            patchRunInList(runId, active);
          }
        }
        await warmInventoryForServerPostCreatorRun(active, sites);
        const latest = await tickServerPostCreatorRun(teamId, active, sites);
        if (latest) patchRunInList(runId, latest);
        return;
      }
      const executionId = existing?.plan?.taskExecutionId;
      if (executionId && existing && agentRunHasResumeProgress(existing)) {
        await reopenTaskExecutionForResume(teamId, executionId);
      }
      const result = await patchAgentRun(teamId, runId, {
        status: "queued",
        errorMessage: "",
        step: { label: "Queued for resume", status: "pending" },
      });
      if (result.ok && result.run) {
        patchRunInList(runId, result.run);
      }
    },
    [patchRunInList, runs, sites, teamId],
  );

  const clearHistory = useCallback(async () => {
    if (!teamId) return;
    const list = runs.length > 0 ? runs : await fetchAgentRuns(teamId);
    const active = list.filter((run) => !isAgentRunTerminal(run.status));
    await Promise.all(active.map((run) => cancelAgentRun(teamId, run.id)));
    await clearAgentRuns(teamId);
    setSelectedRunId(null);
    setRuns([]);
  }, [runs, teamId]);

  useEffect(() => {
    if (!teamId) {
      setRuns([]);
      return;
    }
    void refreshRuns();
    // Fetch once per team; local patches handle run updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    const flush = () => {
      void flushAllAgentRunCheckpointPatches(teamId);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [teamId]);

  useEffect(() => {
    if (!teamId || executingRef.current) return;
    const queued = filterRunnableRuns(runs);
    if (queued.length === 0) return;
    executingRef.current = true;
    void Promise.all(queued.map((run) => executeAgentRun(run, sites))).finally(() => {
      executingRef.current = false;
    });
  }, [runs, sites, teamId]);

  const runsRef = useRef(runs);
  runsRef.current = runs;
  const serverProcessInFlight = useRef(new Set<number>());

  useEffect(() => {
    if (!teamId) return;
    for (const run of runs) {
      if (
        (run.status === "queued" || run.status === "running") &&
        agentRunIsServerExecution(run) &&
        !serverProcessInFlight.current.has(run.id)
      ) {
        serverProcessInFlight.current.add(run.id);
        void warmInventoryForServerPostCreatorRun(run, sites);
        void tickServerPostCreatorRun(teamId, run, sites)
          .then((latest) => {
            if (latest) patchRunInList(run.id, latest);
          })
          .finally(() => {
            serverProcessInFlight.current.delete(run.id);
          });
      }
    }
  }, [patchRunInList, runs, sites, teamId]);

  useEffect(() => {
    if (!teamId || sites.length === 0) return;
    for (const run of runs) {
      if (
        (run.status !== "queued" && run.status !== "running") ||
        !agentRunIsServerExecution(run) ||
        !serverPostCreatorAwaitingUpload(run)
      ) {
        continue;
      }
      void maybeUploadServerPostCreatorRows(teamId, run, sites).then((uploaded) => {
        if (uploaded) patchRunInList(run.id, uploaded);
      });
    }
  }, [patchRunInList, runs, sites, teamId]);

  useEffect(() => {
    if (!teamId) return;
    const tick = async () => {
      const active = runsRef.current.filter(
        (run) =>
          agentRunIsServerExecution(run) &&
          (run.status === "queued" || run.status === "running"),
      );
      if (active.length === 0) return;
      await Promise.all(
        active.map(async (run) => {
          const latest = await tickServerPostCreatorRun(teamId, run, sites);
          if (latest) patchRunInList(run.id, latest);
        }),
      );
    };
    void tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [patchRunInList, sites, teamId]);

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const hasTerminalHistory = useMemo(() => hasTerminalRuns(runs), [runs]);

  const value = useMemo(
    () => ({
      runs,
      selectedRunId,
      selectedRun,
      sidebarOpen,
      setSidebarOpen,
      sidebarPanel,
      setSidebarPanel,
      openSidebar,
      selectRun: setSelectedRunId,
      refreshRuns,
      patchRunInList,
      startRun,
      startRunFromTask,
      cancelRun,
      resumeRun,
      clearHistory,
      hasTerminalHistory,
    }),
    [
      cancelRun,
      clearHistory,
      hasTerminalHistory,
      openSidebar,
      patchRunInList,
      refreshRuns,
      resumeRun,
      runs,
      selectedRun,
      selectedRunId,
      sidebarOpen,
      setSidebarOpen,
      sidebarPanel,
      setSidebarPanel,
      startRun,
      startRunFromTask,
    ],
  );

  return <AgentRunsContext.Provider value={value}>{children}</AgentRunsContext.Provider>;
}
