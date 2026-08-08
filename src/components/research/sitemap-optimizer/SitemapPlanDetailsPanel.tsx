import { Check, Loader2 } from "lucide-react";
import { SitemapOptimizerProgressSteps } from "@/components/research/sitemap-optimizer/SitemapOptimizerProgressPanel";
import {
  SITEMAP_APPROVE_STEPS,
  sitemapApproveActiveStepLines,
  sitemapApproveDoneStepLines,
  sitemapApproveStepStatus,
  type SitemapApproveProgressView,
} from "@/lib/sitemap-optimizer/sitemap-approve-progress-display";
import type { SitemapPlanHeaderProgress } from "@/lib/sitemap-optimizer/sitemap-plan-header-progress";
import type { SitemapOptimizerCollectionKey, SitemapOptimizerProgress } from "@/lib/sitemap-optimizer/types";
import { cn } from "@/lib/utils";
import { contentOptimizerRowStripeClass } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

const INVENTORY_LABELS: Record<SitemapOptimizerCollectionKey, string> = {
  posts: "Posts",
  pages: "Pages",
  entity: "SAP",
};

export type SitemapPlanDetailsPanelProps = {
  workspaceBusy: boolean;
  headerProgress: SitemapPlanHeaderProgress | null;
  analyzeProgress: SitemapOptimizerProgress | null;
  approveProgress: SitemapApproveProgressView | null;
  selectedInventory: SitemapOptimizerCollectionKey;
  gscFileName: string | null;
  gscUploadRowCount: number | null | undefined;
  isRedirectMapHarness: boolean;
  rankMathImportSummary: {
    destinationCount: number;
    matchedSourceCount: number;
    unmatchedCount: number;
  } | null;
  error: string | null | undefined;
  rankMathError: string | null | undefined;
  siteConnected: boolean;
  workspaceMode: string;
};

export function sitemapPlanDetailsCanOpen(
  hasGsc: boolean,
  busy: boolean,
  hasPlan: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasGsc, busy, hasPlan);
}

function SitemapPlanWorkspaceContext(props: SitemapPlanDetailsPanelProps) {
  const {
    selectedInventory,
    gscFileName,
    gscUploadRowCount,
    isRedirectMapHarness,
    rankMathImportSummary,
    workspaceMode,
    siteConnected,
  } = props;
  let kvIndex = 0;
  return (
    <>
      <WorkspaceDetailsKvRow
        label="Inventory"
        value={INVENTORY_LABELS[selectedInventory]}
        stripeIndex={kvIndex++}
      />
      <WorkspaceDetailsKvRow
        label="Mode"
        value={workspaceMode === "temp" ? "Temp seed" : siteConnected ? "Connected site" : "No site"}
        stripeIndex={kvIndex++}
      />
      {gscFileName ? (
        <WorkspaceDetailsKvRow
          label="GSC CSV"
          value={`${gscFileName} (${gscUploadRowCount ?? 0} rows${isRedirectMapHarness ? " · redirect map" : ""})`}
          stripeIndex={kvIndex++}
        />
      ) : null}
      {rankMathImportSummary ? (
        <WorkspaceDetailsKvRow
          label="Rank Math plan"
          value={`${rankMathImportSummary.destinationCount} destination(s) · ${rankMathImportSummary.matchedSourceCount} matched${rankMathImportSummary.unmatchedCount > 0 ? ` · ${rankMathImportSummary.unmatchedCount} unmatched` : ""}`}
          stripeIndex={kvIndex++}
        />
      ) : null}
    </>
  );
}

export function SitemapPlanDetailsPanel(props: SitemapPlanDetailsPanelProps) {
  const {
    workspaceBusy,
    headerProgress,
    analyzeProgress,
    approveProgress,
    error,
    rankMathError,
    siteConnected,
    workspaceMode,
  } = props;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        <SitemapPlanWorkspaceContext {...props} />
      </WorkspaceDetailsSection>

      <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
        {workspaceBusy && analyzeProgress ? (
          <>
            {headerProgress?.phase ? (
              <WorkspaceDetailsKvRow label="Phase" value={headerProgress.phase} stripeIndex={0} />
            ) : null}
            <SitemapOptimizerProgressSteps progress={analyzeProgress} embedded />
          </>
        ) : workspaceBusy && approveProgress ? (
          <>
            {headerProgress?.phase ? (
              <WorkspaceDetailsKvRow label="Phase" value={headerProgress.phase} stripeIndex={0} />
            ) : null}
            <ol className="flex flex-col gap-0" aria-live="polite">
              {SITEMAP_APPROVE_STEPS.map((step, index) => {
                const status = sitemapApproveStepStatus(step.id, approveProgress);
                const lines =
                  status === "active"
                    ? sitemapApproveActiveStepLines(step.id, approveProgress)
                    : status === "done"
                      ? sitemapApproveDoneStepLines(step.id, approveProgress)
                      : ["Waiting"];
                return (
                  <li
                    key={step.id}
                    className={cn(
                      "flex items-start gap-3 border-0 px-2.5 py-2.5 sm:px-3",
                      contentOptimizerRowStripeClass(index, { isActiveOptimize: status === "active" }),
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center" aria-hidden>
                      {status === "done" ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : status === "active" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <span className="text-base font-semibold text-white">{index + 1}</span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium text-white">{step.label}</p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {lines.map((line) => (
                          <li key={line} className="text-base text-muted-foreground">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <>
            {(error || rankMathError) && !workspaceBusy ? (
              <WorkspaceDetailsKvRow label="Error" value={error ?? rankMathError ?? ""} stripeIndex={0} />
            ) : null}
            {!siteConnected && workspaceMode !== "temp" ? (
              <p className="px-2.5 py-2 text-muted-foreground sm:px-3">
                GSC pages analysis needs a connected WordPress site; redirect maps can run without one.
              </p>
            ) : null}
          </>
        )}
      </WorkspaceDetailsSection>
    </WorkspaceDetailsStack>
  );
}
