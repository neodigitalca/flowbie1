import React from "react";
import { Progress } from "@/components/ui/progress";
import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COPIED_TO_CLIPBOARD_2 } from "@/lib/notify-messages";
import { cn } from "@/lib/utils";
import type { OptimizationProgressState } from "@/hooks/content-optimization/use-optimization-state";
import { BulkHarnessSectionsPanel } from "@/components/keyword-research/bulk/BulkHarnessSectionsPanel";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

interface ContentOptimizationMicroProgressProps {
  progress?: OptimizationProgressState;
  isOptimizing: boolean;
  className?: string;
}

/**
 * Progress bar with step + percent above, and a single inline detail line under the bar when `message` is set.
 */
export const ContentOptimizationMicroProgress: React.FC<ContentOptimizationMicroProgressProps> = ({
  progress,
  isOptimizing,
  className,
}) => {
  if (!isOptimizing || !progress || typeof progress !== "object") {
    return null;
  }

  const pct = Math.round(progress.progress ?? 0);
  const step = progress.step || "Processing…";
  const detail = progress.message?.trim();
  const showDetail =
    Boolean(detail) && detail!.toLowerCase() !== step.trim().toLowerCase();
  const copyText = detail ? `${step}\n${detail}` : step;
  const hasHarnessSections =
    progress.harnessSections != null && progress.harnessSections.length > 0;

  return (
    <div
      className={cn(
        "space-y-2 text-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 font-medium">{step}</span>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(copyText);
              notify.success(NOTIFY_COPIED_TO_CLIPBOARD_2);
            }}
            title="Copy status"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <span className="tabular-nums text-muted-foreground">{pct}%</span>
        </div>
      </div>
      {!hasHarnessSections ? <Progress value={pct} className="h-2" /> : null}

      {hasHarnessSections ? (
        <BulkHarnessSectionsPanel
          harnessSections={progress.harnessSections as BulkHarnessSectionUi[]}
          harnessPlannedSectionCount={progress.harnessPlannedSectionCount ?? null}
          currentRow={0}
          totalRows={1}
          isProcessing={isOptimizing}
        />
      ) : null}

      {showDetail ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
          <span className="min-w-0 flex-1 break-words leading-snug">{detail}</span>
        </div>
      ) : null}
    </div>
  );
};
