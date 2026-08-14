import type { AgentRunStep } from "@/lib/agent-runs-types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

type AgentRunStepListProps = {
  steps: AgentRunStep[];
};

function StepIcon({ status }: { status: AgentRunStep["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-hidden />;
  if (status === "error") return <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />;
  if (status === "running") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />;
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}

export function AgentRunStepList({ steps }: AgentRunStepListProps) {
  if (steps.length === 0) {
    return <p className="text-base text-muted-foreground">No steps yet.</p>;
  }

  return (
    <div className="agent-runs-step-list">
      {steps.map((step) => (
        <div key={step.id} className={cn("agent-runs-step-row", step.status === "error" && "text-destructive")}>
          <StepIcon status={step.status} />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
