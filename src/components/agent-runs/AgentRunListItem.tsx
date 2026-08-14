import type { AgentRun, AgentRunStatus } from "@/lib/agent-runs-types";
import { AGENT_RUN_SOURCE_LABELS, AGENT_RUN_STATUS_LABELS } from "@/lib/agent-runs-types";
import { cn } from "@/lib/utils";

function statusClass(status: AgentRunStatus): string {
  return `agent-runs-status-pill agent-runs-status-pill--${status}`;
}

type AgentRunListItemProps = {
  run: AgentRun;
  selected: boolean;
  onSelect: () => void;
};

export function AgentRunListItem({ run, selected, onSelect }: AgentRunListItemProps) {
  return (
    <button
      type="button"
      className={cn("agent-runs-list-item", selected && "agent-runs-list-item--selected")}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">{run.title}</span>
        <span className={statusClass(run.status)}>{AGENT_RUN_STATUS_LABELS[run.status]}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-base text-muted-foreground">
        <span>{run.recipeTitle}</span>
        <span className="agent-runs-source-badge">{AGENT_RUN_SOURCE_LABELS[run.source]}</span>
      </div>
    </button>
  );
}
