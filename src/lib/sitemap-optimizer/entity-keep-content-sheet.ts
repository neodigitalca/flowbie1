import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import type {
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

/** Content sheet row for a GSC performer kept at its current URL (no redirect). */
export function buildGscKeepContentSheetRow(
  row: SitemapOptimizerPostRow,
  rationale?: string,
): SitemapOptimizerContentSheetRow {
  const legacy = gridMemberSourceUrl(row).trim() || row.url.trim();
  const unchangedUrl = legacy;
  return {
    postId: row.postId,
    sourceUrl: unchangedUrl,
    legacySourceUrl: row.gridRedirectFromUrl?.trim() || undefined,
    sourceTitle: "",
    action: "keep",
    priority: "low",
    proposedTitle: displayPostTitle(row.title),
    proposedPrimaryKeyword: row.keyword.trim() || displayPostTitle(row.title).slice(0, 40),
    proposedMeta: row.meta.trim(),
    rationale:
      rationale?.trim() ||
      row.gscTriageRationale?.trim() ||
      "GSC performance triage: relative site traffic warrants keeping this URL live.",
    proposedDestinationUrl: unchangedUrl,
    gscClicks: row.gscPageClicks,
    gscImpressions: row.gscPageImpressions,
    mergeSourceCount: 1,
    isSingletonCluster: true,
  };
}

export function buildGscKeepContentSheetRows(
  rows: readonly SitemapOptimizerPostRow[],
): SitemapOptimizerContentSheetRow[] {
  return rows.map((row) => buildGscKeepContentSheetRow(row));
}
