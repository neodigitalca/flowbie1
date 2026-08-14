import type { AgentRun } from "@/lib/agent-runs-types";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";

type AgentRunSummaryProps = {
  run: AgentRun;
};

export function AgentRunSummary({ run }: AgentRunSummaryProps) {
  if (!isAgentRunTerminal(run.status)) return null;

  if (run.status === "failed" || run.status === "cancelled") {
    return (
      <p className="text-base text-muted-foreground">
        {run.errorMessage || (run.status === "cancelled" ? "Run was cancelled." : "Run failed.")}
      </p>
    );
  }

  const result = run.result;
  if (!result) {
    return <p className="text-base text-muted-foreground">Run completed.</p>;
  }

  const parts: string[] = [];
  if (typeof result.updated === "number") parts.push(`${result.updated} updated`);
  if (typeof result.skipped === "number") parts.push(`${result.skipped} skipped`);
  if (typeof result.failed === "number") parts.push(`${result.failed} failed`);
  if (result.message) parts.push(result.message);

  return <p className="text-base text-muted-foreground">{parts.join(" · ") || "Run completed."}</p>;
}
