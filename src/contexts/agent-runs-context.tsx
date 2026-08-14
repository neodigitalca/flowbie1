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
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import {
  createAgentRun,
  fetchAgentRun,
  fetchAgentRuns,
} from "@/lib/agent-runs-api";
import {
  executeAgentRun,
  filterRunnableRuns,
  hasPollingRuns,
} from "@/lib/agent-runs/executor";
import { writeAgentRunsSidebarOpen } from "@/lib/agent-runs/storage";
import type { AgentRun, StartAgentRunPayload } from "@/lib/agent-runs-types";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import { startTaskExecution } from "@/lib/tasks-api";
import { taskExecutionKindToRecipe } from "@/lib/agent-runs-types";
import type { TeamTask } from "@/lib/tasks-types";

type AgentRunsContextValue = {
  runs: AgentRun[];
  selectedRunId: number | null;
  selectedRun: AgentRun | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  openSidebar: (runId?: number) => void;
  selectRun: (runId: number | null) => void;
  refreshRuns: () => Promise<void>;
  startRun: (payload: StartAgentRunPayload) => Promise<{ ok: boolean; run?: AgentRun; error?: string }>;
  startRunFromTask: (task: TeamTask) => Promise<{ ok: boolean; run?: AgentRun; error?: string }>;
  cancelRun: (runId: number) => Promise<void>;
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
};

export function AgentRunsContextProvider({
  children,
  sidebarOpen,
  setSidebarOpen,
}: AgentRunsContextProviderProps) {
  const { activeTeam } = useTeam();
  const { sites } = useWordPressSites();
  const teamId = activeTeam?.id ?? null;

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const executingRef = useRef(false);

  const refreshRuns = useCallback(async () => {
    if (!teamId) {
      setRuns([]);
      return;
    }
    const list = await fetchAgentRuns(teamId);
    setRuns(list);
  }, [teamId]);

  const openSidebar = useCallback(
    (runId?: number) => {
      setSidebarOpen(true);
      writeAgentRunsSidebarOpen(true);
      if (runId) setSelectedRunId(runId);
    },
    [setSidebarOpen],
  );

  const startRun = useCallback(
    async (payload: StartAgentRunPayload) => {
      const result = await createAgentRun(payload);
      if (result.ok && result.run) {
        await refreshRuns();
        openSidebar(result.run.id);
      }
      return result;
    },
    [openSidebar, refreshRuns],
  );

  const startRunFromTask = useCallback(
    async (task: TeamTask) => {
      if (!teamId) return { ok: false, error: "No active team" };
      const recipeKey = taskExecutionKindToRecipe(task.executionKind ?? "");
      if (!recipeKey) return { ok: false, error: "Task has no execution recipe" };

      const exec = await startTaskExecution(teamId, task.id, {
        executionKind: task.executionKind,
        executionPayload: task.executionPayload,
      });
      if (!exec.ok || !exec.execution) {
        return { ok: false, error: exec.error ?? "Could not start task execution" };
      }

      if (exec.execution.status === "completed") {
        return startRun({
          teamId,
          source: "task_manager",
          recipeKey,
          title: task.title,
          taskId: task.id,
          context: {
            siteId: task.wordpressSiteId,
            taskKeyword: task.keyword,
            taskTitle: task.title,
            projectId: task.projectId,
          },
          plan: {
            taskExecutionId: exec.execution.id,
            completedOnServer: true,
          },
        });
      }

      return startRun({
        teamId,
        source: "task_manager",
        recipeKey,
        title: task.title,
        taskId: task.id,
        context: {
          siteId: task.wordpressSiteId,
          taskKeyword: task.keyword,
          taskTitle: task.title,
          projectId: task.projectId,
        },
        plan: {
          taskExecutionId: exec.execution.id,
          clientRunContract: exec.execution.clientRunContract ?? undefined,
        },
      });
    },
    [startRun, teamId],
  );

  const cancelRun = useCallback(
    async (runId: number) => {
      if (!teamId) return;
      const { cancelAgentRun } = await import("@/lib/agent-runs-api");
      await cancelAgentRun(teamId, runId);
      await refreshRuns();
    },
    [refreshRuns, teamId],
  );

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    if (!teamId || !hasPollingRuns(runs)) return;
    const id = window.setInterval(() => void refreshRuns(), 3000);
    return () => window.clearInterval(id);
  }, [refreshRuns, runs, teamId]);

  useEffect(() => {
    if (!teamId || executingRef.current) return;
    const queued = filterRunnableRuns(runs);
    if (queued.length === 0) return;
    executingRef.current = true;
    void Promise.all(queued.map((run) => executeAgentRun(run, sites)))
      .then(refreshRuns)
      .finally(() => {
        executingRef.current = false;
      });
  }, [refreshRuns, runs, sites, teamId]);

  useEffect(() => {
    if (!teamId || !selectedRunId) return;
    if (runs.some((r) => r.id === selectedRunId && !isAgentRunTerminal(r.status))) return;
    void fetchAgentRun(teamId, selectedRunId).then((run) => {
      if (!run) return;
      setRuns((prev) => {
        const idx = prev.findIndex((r) => r.id === run.id);
        if (idx < 0) return [run, ...prev];
        const next = [...prev];
        next[idx] = run;
        return next;
      });
    });
  }, [runs, selectedRunId, teamId]);

  const selectedRun = useMemo(
    () => runs.find((r) => r.id === selectedRunId) ?? null,
    [runs, selectedRunId],
  );

  const value = useMemo(
    () => ({
      runs,
      selectedRunId,
      selectedRun,
      sidebarOpen,
      setSidebarOpen,
      openSidebar,
      selectRun: setSelectedRunId,
      refreshRuns,
      startRun,
      startRunFromTask,
      cancelRun,
    }),
    [
      cancelRun,
      openSidebar,
      refreshRuns,
      runs,
      selectedRun,
      selectedRunId,
      sidebarOpen,
      setSidebarOpen,
      startRun,
      startRunFromTask,
    ],
  );

  return <AgentRunsContext.Provider value={value}>{children}</AgentRunsContext.Provider>;
}
