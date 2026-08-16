import type { MouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import { isAgentRunResumable } from "@/lib/agent-runs/agent-run-checkpoint";
import type { AgentRun, AgentRunStatus } from "@/lib/agent-runs-types";
import { AGENT_RUN_STATUS_LABELS, isAgentRunTerminal } from "@/lib/agent-runs-types";
import { agentRunCardTitle, agentRunCollapsedHint, agentRunIsServerExecution, agentRunServerStatusLabel } from "@/lib/agent-runs/agent-run-display";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";
import { AgentRunsDetailsDrawer } from "./AgentRunsDetailsDrawer";
import { useAgentRunLiveSnapshot } from "./use-agent-run-live-snapshot";
import { useAgentRunPostCreatorProof } from "./use-agent-run-post-creator-proof";

function statusClass(status: AgentRunStatus): string {
  return `agent-runs-status-pill agent-runs-status-pill--${status}`;
}

type AgentRunCardProps = {
  run: AgentRun;
  expanded: boolean;
  stripeIndex: number;
  clientLabel?: string | null;
  onToggle: () => void;
  onCancel: () => void;
  onResume?: () => void;
  resumable?: boolean;
};

export function AgentRunCard({
  run,
  expanded,
  stripeIndex,
  clientLabel,
  onToggle,
  onCancel,
  onResume,
  resumable = false,
}: AgentRunCardProps) {
  const live = useAgentRunLiveSnapshot(run);
  const proof = useAgentRunPostCreatorProof(run);
  const hint = agentRunCollapsedHint(run, live, 0, proof);
  const cardTitle = agentRunCardTitle(run, clientLabel);
  const drawerId = `agent-run-drawer-${run.id}`;
  const isActive = run.status === "running";
  const isServerRun = agentRunIsServerExecution(run);
  const serverStatus = isServerRun ? agentRunServerStatusLabel(run) : null;
  const showResume = resumable || isAgentRunResumable(run);
  const showCancel = !isAgentRunTerminal(run.status);
  const showResumeAction = showResume && Boolean(onResume);

  const handleRowClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    onToggle();
  };

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS}>
      <div
        className={cn(
          "agent-runs-card__row",
          contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize: isActive }),
          expanded && "agent-runs-card__row--expanded",
        )}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={drawerId}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="agent-runs-card__title">{cardTitle}</div>
        <div className="agent-runs-card__meta">
          {!expanded && hint ? <span className="agent-runs-card__hint">{hint}</span> : null}
          {expanded && isServerRun && isActive && serverStatus ? (
            <span className="agent-runs-card__server-status">{serverStatus}</span>
          ) : null}
        </div>
        <span className={statusClass(run.status)}>{AGENT_RUN_STATUS_LABELS[run.status]}</span>
        <button
          type="button"
          className="agent-runs-card__chevron"
          aria-label={expanded ? "Collapse details" : "Expand details"}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      </div>

      <div
        id={drawerId}
        className={cn("agent-runs-card__drawer", !expanded && "agent-runs-card__drawer--collapsed")}
        aria-hidden={!expanded}
      >
        <div className="agent-runs-card__drawer-inner">
          <AgentRunsDetailsDrawer
            run={run}
            resumable={showResume}
            showCancel={showCancel}
            showResume={showResumeAction}
            onCancel={onCancel}
            onResume={onResume}
          />
        </div>
      </div>
    </div>
  );
}
