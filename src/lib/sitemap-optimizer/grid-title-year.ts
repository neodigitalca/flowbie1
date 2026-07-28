import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { isCompanyNewsRow } from "@/lib/sitemap-optimizer/grid-company-news";
import { isTemporalCannibalizationCluster } from "@/lib/sitemap-optimizer/grid-temporal-cannibalization";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

const YEAR_TOKEN = /\b(19|20)\d{2}\b/g;

export function getGridContentYear(referenceDate?: string | Date): number {
  if (referenceDate) {
    const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  return new Date().getFullYear();
}

/** Replace standalone 4-digit years with the target year (e.g. budget headlines). */
export function yearsInText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.matchAll(YEAR_TOKEN)) {
    const y = match[0];
    if (!seen.has(y)) {
      seen.add(y);
      out.push(y);
    }
  }
  return out;
}

/** If the focus keyword names a year, the title must include that year (AI guardrail). */
export function ensureKeywordYearsInTitle(keyword: string, title: string): string {
  const years = yearsInText(keyword.trim());
  if (!years.length) return title.trim();
  let out = title.trim();
  if (!out) return years.map((y, i) => (i === 0 ? y : "")).join(" ").trim() || keyword.trim().slice(0, 60);

  for (const y of years) {
    if (out.includes(y)) continue;
    const prefixed = `${y} ${out}`;
    out = prefixed.length <= 60 ? prefixed : `${y} ${out}`.slice(0, 60).replace(/\s+\S*$/, "").trim();
  }
  return out;
}

export function refreshYearsInText(text: string, year: number): string {
  const t = text.trim();
  if (!t) return t;
  return t.replace(YEAR_TOKEN, String(year));
}

/** Replace 19xx/20xx in URL path segments (slug years, dated paths); leaves origin/query/hash intact. */
export function refreshYearsInUrl(url: string, year: number): string {
  const t = url.trim();
  if (!t) return t;
  const yearStr = String(year);
  try {
    const u = new URL(t);
    const hadTrailingSlash = u.pathname.endsWith("/");
    u.pathname = u.pathname.replace(/(19|20)\d{2}/g, yearStr);
    if (hadTrailingSlash && !u.pathname.endsWith("/")) {
      u.pathname = `${u.pathname}/`;
    }
    return u.toString();
  } catch {
    return t.replace(/(19|20)\d{2}/g, yearStr);
  }
}

export function refreshGridRowDestinationUrl(
  row: SitemapOptimizerPostRow,
  year: number,
): SitemapOptimizerPostRow {
  if (isCompanyNewsRow(row)) return row;
  const url = row.url?.trim();
  if (!url) return row;
  return { ...row, url: refreshYearsInUrl(url, year) };
}

export function shouldRefreshYearsForCluster(
  members: readonly SitemapOptimizerPostRow[],
  cluster?: Pick<SitemapOptimizerCluster, "clusterId" | "rationale">,
): boolean {
  if (cluster && isTemporalCannibalizationCluster(cluster)) return false;
  return members.length > 0 && !members.some((m) => isCompanyNewsRow(m));
}

export function refreshMergeRecommendationTitles(
  merge: SitemapOptimizerMergeRecommendation,
  members: readonly SitemapOptimizerPostRow[],
  year: number,
  cluster?: Pick<SitemapOptimizerCluster, "clusterId" | "rationale">,
): SitemapOptimizerMergeRecommendation {
  if (!shouldRefreshYearsForCluster(members, cluster)) return merge;
  const locked = merge.lockedDestinationUrl?.trim();
  const keyword = refreshYearsInText(merge.recommendedPrimaryKeyword.trim(), year);
  const title = ensureKeywordYearsInTitle(
    keyword,
    refreshYearsInText(displayPostTitle(merge.recommendedTitle), year),
  );
  return {
    ...merge,
    recommendedTitle: title,
    recommendedPrimaryKeyword: keyword,
    recommendedMeta: ensureKeywordYearsInTitle(
      keyword,
      refreshYearsInText(merge.recommendedMeta.trim(), year),
    ),
    ...(locked ? { lockedDestinationUrl: refreshYearsInUrl(locked, year) } : {}),
  };
}

export function refreshContentSheetRowTitles(
  row: SitemapOptimizerContentSheetRow,
  members: readonly SitemapOptimizerPostRow[],
  year: number,
  cluster?: Pick<SitemapOptimizerCluster, "clusterId" | "rationale">,
): SitemapOptimizerContentSheetRow {
  if (!shouldRefreshYearsForCluster(members, cluster)) return row;
  return {
    ...row,
    sourceUrl: refreshYearsInUrl(row.sourceUrl, year),
    proposedDestinationUrl: refreshYearsInUrl(row.proposedDestinationUrl, year),
    sourceTitle: refreshYearsInText(displayPostTitle(row.sourceTitle), year),
    proposedTitle: refreshYearsInText(displayPostTitle(row.proposedTitle), year),
    proposedPrimaryKeyword: refreshYearsInText(row.proposedPrimaryKeyword.trim(), year),
    proposedMeta: refreshYearsInText(row.proposedMeta.trim(), year),
  };
}
