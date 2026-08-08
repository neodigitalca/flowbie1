import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompetitorComparisonHarnessPanel } from "@/components/competitor-generator/CompetitorComparisonHarnessPanel";
import type { CompetitorGenerationProgress } from "@/components/competitor-generation/types";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";

export type CompetitorDetailsDrawerProps = {
  workspaceBusy: boolean;
  progress: CompetitorGenerationProgress | null;
  uploadLabel: string;
  keyword: string;
  rowCount: number;
  hasRowsForCsv: boolean;
  onDownloadTargetsCsv: () => void;
};

export function CompetitorDetailsDrawer({
  workspaceBusy,
  progress,
  uploadLabel,
  keyword,
  rowCount,
  hasRowsForCsv,
  onDownloadTargetsCsv,
}: CompetitorDetailsDrawerProps) {
  const hasHarness = (progress?.harnessGroups?.length ?? 0) > 0;
  let stripe = 0;

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS}>
      <div className={contentOptimizerRowStripeClass(stripe++)}>
        <div className="grid gap-1 px-2.5 py-1.5 text-base sm:px-3">
          <p className="text-white">
            <span className="text-muted-foreground">Keyword · </span>
            {keyword.trim() || "—"}
          </p>
          <p className="text-white">
            <span className="text-muted-foreground">Competitor rows · </span>
            {rowCount}
          </p>
          {uploadLabel ? (
            <p className="text-white">
              <span className="text-muted-foreground">Grid upload · </span>
              {uploadLabel}
            </p>
          ) : null}
        </div>
      </div>

      {hasHarness && progress?.harnessGroups ? (
        <div className={contentOptimizerRowStripeClass(stripe++)}>
          <CompetitorComparisonHarnessPanel
            phase={progress.currentMessage}
            harnessGroups={progress.harnessGroups}
          />
        </div>
      ) : null}

      {!workspaceBusy ? (
        <div className={contentOptimizerRowStripeClass(stripe++)}>
          <div className="flex flex-wrap gap-2 px-2.5 py-2 sm:px-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-0 bg-zinc-900 text-base shadow-none hover:bg-zinc-800"
              disabled={!hasRowsForCsv}
              onClick={onDownloadTargetsCsv}
            >
              <Download className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Bulk CSV
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
