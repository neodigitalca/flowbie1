import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { LegacyRedirectBatchProgress, LegacyRedirectHeaderProgress } from "@/lib/sitemap-optimizer/types";

export type SitemapLegacyRedirectWorkspaceBindings = {
  generating: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  headerProgress: LegacyRedirectHeaderProgress | null;
  canOpenDetails: boolean;
  hasSheet: boolean;
  sheetName: string | null;
  sheetLineCount: number;
  matchedCount: number;
  processedCount: number;
  batchProgress: LegacyRedirectBatchProgress[];
  catalogSize: number | null;
  inventoryFilename: string | null;
  inventoryRowCount: number | null;
  inventoryHref: string | null;
  error: string | null;
  onUploadClick: () => void;
  onGenerate: () => void;
  onCancel: () => void;
  onDownloadCsv: () => void;
  canDownloadCsv: boolean;
};
