import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  entityLevelShortLabel,
  entityTypeShortLabel,
  type EntityGeographicLevel,
} from "@/lib/entity-geographic-level";
import {
  activePhaseIndex,
  LOCAL_ANALYSIS_SUGGEST_PHASES,
  type LocalAnalysisHeaderProgress,
} from "@/lib/local-analysis/header-progress";
import { EntityTitleClusterHarnessPanel } from "@/components/sap-generator/EntityTitleClusterHarnessPanel";
import { cn } from "@/lib/utils";
import { contentOptimizerRowStripeClass } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { BulkSitemapInventoryRunDetail } from "@/components/keyword-research/bulk/BulkSitemapInventoryRunDetail";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

export type LocalAnalysisDetailsPanelProps = {
  workspaceBusy: boolean;
  headerProgress: LocalAnalysisHeaderProgress | null;
  uploadLabel: string;
  keywordTargetCount: number;
  sapRowCount: number;
  entityGeographicLevel: EntityGeographicLevel;
  entityTypeFocus: string[];
  gridSummaryMarkdown: string;
  strategyMarkdown: string;
  hasSapRowsForCsv: boolean;
  displayRows: CSVRow[];
  currentRow: number;
  harnessByRow?: Map<number, BulkHarnessSectionUi[]>;
  batchPrepHarnessSections?: BulkHarnessSectionUi[];
  sitemapInventoryLinks?: PromptBulkSitemapInventoryLink[];
  gscHostedLink?: BulkGscKeywordsHostedLink | null;
  onDownloadTargetsCsv: () => void;
  onDownloadStrategyMarkdown: () => void;
};

export function localAnalysisDetailsCanOpen(
  hasData: boolean,
  busy: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasData, busy);
}

export function LocalAnalysisDetailsPanel({
  workspaceBusy,
  headerProgress,
  uploadLabel,
  keywordTargetCount,
  sapRowCount,
  entityGeographicLevel,
  entityTypeFocus,
  gridSummaryMarkdown,
  strategyMarkdown,
  hasSapRowsForCsv,
  sitemapInventoryLinks = [],
  gscHostedLink = null,
  onDownloadTargetsCsv,
  onDownloadStrategyMarkdown,
}: LocalAnalysisDetailsPanelProps) {
  const focusLabel =
    entityTypeFocus.length > 0
      ? entityTypeFocus.map((t) => entityTypeShortLabel(entityGeographicLevel, t)).join(", ")
      : "None";

  const harnessActive =
    workspaceBusy &&
    headerProgress?.kind === "generate" &&
    (headerProgress.titleHarnessGroups?.length ?? 0) > 0;
  const pipelineBusy =
    workspaceBusy && headerProgress && !harnessActive && headerProgress.kind !== "generate";

  const phases =
    headerProgress?.kind === "suggest" || headerProgress?.kind === "generate"
      ? LOCAL_ANALYSIS_SUGGEST_PHASES
      : [];
  const activeIdx =
    headerProgress && phases.length > 0
      ? activePhaseIndex(phases, headerProgress.phase)
      : -1;

  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        <WorkspaceDetailsKvRow label="Keyword targets" value={String(keywordTargetCount)} stripeIndex={kvIndex++} />
        <WorkspaceDetailsKvRow label="SAP rows" value={String(sapRowCount)} stripeIndex={kvIndex++} />
        <WorkspaceDetailsKvRow
          label="Geography"
          value={entityLevelShortLabel(entityGeographicLevel)}
          stripeIndex={kvIndex++}
        />
        <WorkspaceDetailsKvRow label="Entity focus" value={focusLabel} stripeIndex={kvIndex++} />
        {uploadLabel ? (
          <WorkspaceDetailsKvRow label="Grid upload" value={uploadLabel} stripeIndex={kvIndex++} />
        ) : null}
      </WorkspaceDetailsSection>

      <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
        {sitemapInventoryLinks.length > 0 || gscHostedLink ? (
          <BulkSitemapInventoryRunDetail
            links={sitemapInventoryLinks}
            gscHostedLink={gscHostedLink}
          />
        ) : null}

        {harnessActive && headerProgress?.titleHarnessGroups ? (
          <EntityTitleClusterHarnessPanel
            phase={headerProgress.phase}
            clusterGroups={headerProgress.titleHarnessGroups}
            plannedEntityCount={headerProgress.harnessPlannedSectionCount ?? headerProgress.total}
            isProcessing
          />
        ) : pipelineBusy && headerProgress ? (
          <>
            <WorkspaceDetailsKvRow label="Phase" value={headerProgress.phase} stripeIndex={0} />
            {phases.length > 0 ? (
              <ol className="flex flex-col gap-0" aria-label="Run steps">
                {phases.map((step, i) => {
                  const status =
                    activeIdx < 0
                      ? "pending"
                      : i < activeIdx
                        ? "done"
                        : i === activeIdx
                          ? "active"
                          : "pending";
                  return (
                    <li
                      key={step}
                      className={cn(
                        "border-0 px-2.5 py-1.5 text-base sm:px-3",
                        contentOptimizerRowStripeClass(i + 1, { isActiveOptimize: status === "active" }),
                        status === "done" && "text-muted-foreground",
                        status === "pending" && "text-muted-foreground/70",
                        status === "active" && "text-white",
                      )}
                    >
                      {step}
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </>
        ) : !workspaceBusy ? (
          <>
            {gridSummaryMarkdown.trim() ? (
              <details className="border-0 bg-zinc-950">
                <summary className="cursor-pointer px-2.5 py-2 text-white sm:px-3">Grid summary</summary>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-2.5 pb-2.5 text-base text-muted-foreground sm:px-3">
                  {gridSummaryMarkdown.trim().slice(0, 4000)}
                  {gridSummaryMarkdown.length > 4000 ? "\n…" : ""}
                </pre>
              </details>
            ) : null}
            {strategyMarkdown.trim() ? (
              <details className="border-0 bg-zinc-950">
                <summary className="cursor-pointer px-2.5 py-2 text-white sm:px-3">Grid strategy</summary>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-2.5 pb-2.5 text-base text-muted-foreground sm:px-3">
                  {strategyMarkdown.trim().slice(0, 4000)}
                  {strategyMarkdown.length > 4000 ? "\n…" : ""}
                </pre>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-2 px-2.5 py-2 sm:px-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-0 bg-zinc-900 text-base shadow-none hover:bg-zinc-800"
                disabled={!hasSapRowsForCsv}
                onClick={onDownloadTargetsCsv}
              >
                <Download className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Bulk CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-0 bg-zinc-900 text-base shadow-none hover:bg-zinc-800"
                disabled={!strategyMarkdown.trim()}
                onClick={onDownloadStrategyMarkdown}
              >
                <Download className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Grid strategy
              </Button>
            </div>
          </>
        ) : null}
      </WorkspaceDetailsSection>
    </WorkspaceDetailsStack>
  );
}
