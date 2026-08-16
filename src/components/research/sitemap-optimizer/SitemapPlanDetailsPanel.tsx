import type { SitemapPlanHeaderProgress } from "@/lib/sitemap-optimizer/sitemap-plan-header-progress";
import type { SitemapApproveProgressView } from "@/lib/sitemap-optimizer/sitemap-approve-progress-display";
import type { SitemapOptimizerCollectionKey, SitemapOptimizerProgress } from "@/lib/sitemap-optimizer/types";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

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
