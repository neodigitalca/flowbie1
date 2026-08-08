import React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OptimizationProgressState } from "@/hooks/content-optimization/use-optimization-state";
import {
  downloadOptimizationProgressLog,
  formatRawOptimizationProgressLog,
  pickLatestOptimizationStatus,
} from "@/lib/content-optimization/optimization-progress-humanize";

export function OptimizationProgressInlineStatus({
  progress,
  isOptimizing,
  reserveBand = false,
}: {
  progress: OptimizationProgressState | undefined;
  isOptimizing: boolean;
  /** Details drawer: keep min-h-9 even before first milestone. */
  reserveBand?: boolean;
}) {
  const latestStatus = pickLatestOptimizationStatus(progress);
  const canDownload = formatRawOptimizationProgressLog(progress).trim().length > 0;

  if (!latestStatus.trim() && !reserveBand) return null;

  return (
    <div
      className="flex min-h-9 min-w-0 items-center gap-2 px-2.5 py-1.5 sm:px-3"
      role="status"
      aria-live="polite"
    >
      {isOptimizing ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
      ) : null}
      <span
        className="min-w-0 flex-1 truncate text-base leading-snug text-muted-foreground"
        title={latestStatus || undefined}
      >
        {latestStatus || "\u00A0"}
      </span>
      {canDownload ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-base text-muted-foreground hover:bg-white/10 hover:text-white"
          onClick={() => downloadOptimizationProgressLog(progress)}
          aria-label="Download log"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Download log
        </Button>
      ) : null}
    </div>
  );
}
