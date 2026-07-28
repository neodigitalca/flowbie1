import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import type {
  SitemapOptimizerPostRow,
  SitemapOptimizerStandaloneProposal,
} from "@/lib/sitemap-optimizer/types";

function keywordFromRow(row: SitemapOptimizerPostRow): string {
  const fromMeta = row.keyword.trim();
  if (fromMeta) return fromMeta;
  const fromGsc = row.gscQueries.find((q) => q.query.trim())?.query.trim();
  if (fromGsc) return fromGsc;
  const slug = urlPathTail(row.url).replace(/-/g, " ").trim();
  return slug || "content refresh";
}

function metaFromRow(row: SitemapOptimizerPostRow, keyword: string): string {
  const existing = row.meta.trim();
  if (existing.length >= 80 && existing.length <= 160) return existing;
  if (existing.length > 160) return `${existing.slice(0, 157).trim()}...`;
  const base = existing || `Updated guide on ${keyword}. Refresh for search intent and clarity.`;
  return base.length <= 160 ? base : `${base.slice(0, 157).trim()}...`;
}

/** Fallback refresh proposal when the model omits a standalone URL. */
export function buildDeterministicStandaloneProposal(
  row: SitemapOptimizerPostRow,
): SitemapOptimizerStandaloneProposal {
  const keyword = keywordFromRow(row);
  const title = displayPostTitle(row.title.trim() || keyword);
  return {
    postId: row.postId,
    action: "refresh",
    proposedTitle: title,
    proposedPrimaryKeyword: keyword,
    proposedMeta: metaFromRow(row, keyword),
    priority: "medium",
    rationale: "Deterministic refresh brief (model gap filled). Re-run analyze to replace with AI proposals.",
  };
}
