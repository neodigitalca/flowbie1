import type { LegacyRedirectBatchProgress, LegacyRedirectHeaderProgress } from "@/lib/sitemap-optimizer/types";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type SitemapLegacyRedirectDetailsPanelProps = {
  workspaceBusy: boolean;
  headerProgress: LegacyRedirectHeaderProgress | null;
  sheetName: string | null;
  sheetLineCount: number;
  matchedCount: number;
  processedCount: number;
  batchProgress: LegacyRedirectBatchProgress[];
  catalogSize: number | null;
  inventoryFilename: string | null;
  inventoryRowCount: number | null;
  inventoryHref: string | null;
};

export function sitemapLegacyRedirectDetailsCanOpen(
  hasSheet: boolean,
  busy: boolean,
  hasInventory: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasSheet, busy, hasInventory);
}
