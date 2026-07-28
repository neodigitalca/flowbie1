import {
  applyCompanyNewsTags,
  COMPANY_TAG_LABEL,
  COMPANY_TOPIC_TAG,
  isCompanyNewsRow,
  siteBrandTokensForUrl,
} from "@/lib/sitemap-optimizer/grid-company-news";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

export function partitionCompanyEditorialRows(
  rows: readonly SitemapOptimizerPostRow[],
  siteUrl?: string | null,
): {
  tagged: SitemapOptimizerPostRow[];
  editorial: SitemapOptimizerPostRow[];
  company: SitemapOptimizerPostRow[];
} {
  const brandTokens = siteBrandTokensForUrl(siteUrl);
  const detectOpts = { siteBrandTokens: brandTokens };
  const tagged = applyCompanyNewsTags(rows, siteUrl);
  const editorial: SitemapOptimizerPostRow[] = [];
  const company: SitemapOptimizerPostRow[] = [];
  for (const row of tagged) {
    if (isCompanyNewsRow(row, detectOpts)) {
      company.push(normalizeCompanyRowForKeep(row));
    } else {
      editorial.push(row);
    }
  }
  return { tagged, editorial, company };
}

/** Preserve legacy URL — do not apply redirect-map destination rewrites. */
export function normalizeCompanyRowForKeep(row: SitemapOptimizerPostRow): SitemapOptimizerPostRow {
  const legacy = gridMemberSourceUrl(row).trim() || row.url.trim();
  return {
    ...row,
    url: legacy,
    gridTopicTag: COMPANY_TOPIC_TAG,
    gridTagLabel: COMPANY_TAG_LABEL,
  };
}

export function buildCompanyKeepClusters(
  companyRows: readonly SitemapOptimizerPostRow[],
): SitemapOptimizerClusterResult {
  const clusters: SitemapOptimizerCluster[] = companyRows.map((row) => ({
    clusterId: `company-keep-${row.postId}`,
    label: displayPostTitle(row.title || row.gridTagLabel || "Company content"),
    intent: "mixed",
    memberPostIds: [row.postId],
    confidence: "high" as const,
    rationale: "Firm/company-focused content — preserve URL and copy (no merge or redirect).",
  }));
  return { clusters, singletons: [] };
}

/** Content sheet row: no rewrite, no redirect target change. */
export function buildCompanyKeepContentSheetRow(
  row: SitemapOptimizerPostRow,
): SitemapOptimizerContentSheetRow {
  const legacy = gridMemberSourceUrl(row);
  const unchangedUrl = legacy.trim() || row.url.trim();
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
      "Firm/company-focused content — tagged company, left unchanged (no SEO rewrite or redirect).",
    proposedDestinationUrl: unchangedUrl,
    gridTopicTag: COMPANY_TOPIC_TAG,
    gridTagLabel: COMPANY_TAG_LABEL,
    mergeSourceCount: 1,
    isSingletonCluster: true,
  };
}

export function appendCompanyKeepContentRows(
  sheet: readonly SitemapOptimizerContentSheetRow[],
  companyRows: readonly SitemapOptimizerPostRow[],
): SitemapOptimizerContentSheetRow[] {
  if (!companyRows.length) return [...sheet];
  const keepRows = companyRows.map(buildCompanyKeepContentSheetRow);
  return [...sheet, ...keepRows];
}

export function mergeClusterResults(
  editorial: SitemapOptimizerClusterResult,
  company: SitemapOptimizerClusterResult,
): SitemapOptimizerClusterResult {
  return {
    clusters: [...editorial.clusters, ...company.clusters],
    singletons: [...editorial.singletons, ...company.singletons],
  };
}
