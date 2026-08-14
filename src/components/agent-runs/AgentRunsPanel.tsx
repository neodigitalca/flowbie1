import { Button } from "@/components/ui/button";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { AGENT_RUN_SOURCE_LABELS, isAgentRunTerminal } from "@/lib/agent-runs-types";
import { AgentRunListItem } from "./AgentRunListItem";
import { AgentRunStepList } from "./AgentRunStepList";
import { AgentRunSummary } from "./AgentRunSummary";
import { RUNNING_AGENTS_LABEL } from "./AgentRunsBrandTitle";

export function AgentRunsPanel() {
  const { runs, selectedRun, selectedRunId, selectRun, cancelRun } = useAgentRunsContext();

  const activeRuns = runs.filter((r) => !isAgentRunTerminal(r.status));
  const list = activeRuns.length > 0 ? activeRuns : runs;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="agent-runs-panel-header">
        <h2 className="agent-runs-panel-header__title">{RUNNING_AGENTS_LABEL}</h2>
      </div>
      <div className="agent-runs-body">
        {list.length === 0 ? (
          <div className="agent-runs-empty">
            No automations running. Start one from Pulse Assist Build or execute a task with an agent.
          </div>
        ) : (
          <>
            <div className="agent-runs-list">
              {list.map((run) => (
                <AgentRunListItem
                  key={run.id}
                  run={run}
                  selected={run.id === selectedRunId}
                  onSelect={() => selectRun(run.id)}
                />
              ))}
            </div>
            {selectedRun ? (
              <div className="agent-runs-detail">
                <div className="flex flex-col gap-1">
                  <p className="text-base font-medium">{selectedRun.title}</p>
                  <p className="text-base text-muted-foreground">
                    {selectedRun.recipeTitle} · {AGENT_RUN_SOURCE_LABELS[selectedRun.source]}
                  </p>
                  {selectedRun.taskId > 0 && selectedRun.taskTitle ? (
                    <p className="text-base text-muted-foreground">From task: {selectedRun.taskTitle}</p>
                  ) : null}
                </div>
                <AgentRunStepList steps={selectedRun.steps ?? []} />
                <AgentRunSummary run={selectedRun} />
                {!isAgentRunTerminal(selectedRun.status) ? (
                  <Button type="button" variant="secondary" className="w-fit text-base" onClick={() => void cancelRun(selectedRun.id)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
