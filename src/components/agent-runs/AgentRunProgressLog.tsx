import { Download, ExternalLink } from "lucide-react";
import { contentOptimizerRowStripeClass } from "@/components/overview/overview-tab/overview-tab-content-constants";
import type { AgentRunLogTimelineRow } from "@/lib/agent-runs/agent-run-log-format";
import { cn } from "@/lib/utils";

function statusClass(status: AgentRunLogTimelineRow["status"]): string {
  if (status === "done") return "bg-emerald-400";
  if (status === "error") return "bg-red-400";
  if (status === "pending") return "bg-zinc-500";
  return "bg-cyan-400";
}

function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isContentBucketArtifact(name: string): boolean {
  return /^content-bucket-/i.test(name.trim());
}

type AgentRunProgressLogProps = {
  rows: AgentRunLogTimelineRow[];
};

export function AgentRunProgressLog({ rows }: AgentRunProgressLogProps) {
  if (rows.length === 0) {
    return <p className="px-2.5 py-2 text-base text-muted-foreground sm:px-3">No log entries yet.</p>;
  }

  return (
    <div className="max-h-56 overflow-y-auto px-2.5 py-2 sm:px-3">
      <ul className="space-y-1">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className={cn(
              "flex min-h-[2rem] items-start gap-2 rounded-sm px-2 py-1.5",
              contentOptimizerRowStripeClass(index, { isActiveOptimize: row.isActive }),
            )}
          >
            <span className="min-w-[4.5rem] shrink-0 whitespace-nowrap pt-0.5 text-base tabular-nums text-muted-foreground">
              {row.timeLabel}
            </span>
            <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", statusClass(row.status))} aria-hidden />
            <div className="min-w-0 flex-1">
              <span className="text-base text-zinc-100 [overflow-wrap:anywhere]">{row.label}</span>
              {row.artifacts && row.artifacts.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {row.artifacts.map((artifact) =>
                    isExternalUrl(artifact.url) ? (
                      <a
                        key={artifact.id}
                        href={artifact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-base text-cyan-300 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {artifact.name}
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                      </a>
                    ) : (
                      <a
                        key={artifact.id}
                        href={artifact.url}
                        download={artifact.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex items-center gap-1 text-base hover:underline",
                          isContentBucketArtifact(artifact.name)
                            ? "font-semibold text-emerald-400"
                            : "text-cyan-300",
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-4 w-4 shrink-0" aria-hidden />
                        {artifact.name}
                      </a>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
