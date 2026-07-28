import { isCompanyNewsRow } from "@/lib/sitemap-optimizer/grid-company-news";
import { effectiveGridGeoForRow } from "@/lib/sitemap-optimizer/grid-infer-geo";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** How aggressively redirect-map rows consolidate into shared new blogs. */
export type GridCompressionLevel = "none" | "moderate" | "aggressive";

/** Max URLs = 1 always uses none (1:1); max ≥ 2 uses the selected compression. */
export function effectiveGridCompression(
  maxUrlsPerPost: GridMaxUrlsPerPost,
  compression: GridCompressionLevel,
): GridCompressionLevel {
  return maxUrlsPerPost === 1 ? "none" : compression;
}

export function gridCompressionLabel(level: GridCompressionLevel): string {
  switch (level) {
    case "none":
      return "Basic";
    case "moderate":
      return "Moderate";
    case "aggressive":
      return "Aggressive";
  }
}

export function gridCompressionDescription(level: GridCompressionLevel): string {
  switch (level) {
    case "none":
      return "Directly related blogs only";
    case "moderate":
      return "Same geo + related themes";
    case "aggressive":
      return "Broader themes, more freedom";
  }
}

export function shouldClusterRedirectMapBySharedNewUrl(
  level: GridCompressionLevel,
  maxUrlsPerPost: GridMaxUrlsPerPost,
): boolean {
  return level === "none" && maxUrlsPerPost > 1;
}

/** Max 1 URL per post: one cluster per upload row (1:1 redirects). */
export function isGridInstantRedirectMode(maxUrlsPerPost: GridMaxUrlsPerPost): boolean {
  return maxUrlsPerPost === 1;
}

export function maxUrlsPerPostForCompression(level: GridCompressionLevel): GridMaxUrlsPerPost {
  if (level === "none") return 5;
  return 5;
}

/** Target number of new posts (clusters) for this upload. */
export function targetGridClusterCount(
  urlCount: number,
  maxUrlsPerPost: GridMaxUrlsPerPost,
): number {
  if (urlCount <= 0) return 0;
  return Math.max(1, Math.ceil(urlCount / maxUrlsPerPost));
}

/** Target distinct parent topic tags before packing (should be ≤ cluster target). */
export function targetGridParentTagCount(
  level: GridCompressionLevel,
  urlCount: number,
  maxUrlsPerPost: GridMaxUrlsPerPost,
): number {
  const clusterTarget = targetGridClusterCount(urlCount, maxUrlsPerPost);
  if (level === "aggressive") {
    return Math.min(25, Math.max(12, clusterTarget));
  }
  if (level === "moderate") {
    return Math.min(50, Math.max(25, clusterTarget * 2));
  }
  return Math.min(80, clusterTarget * 3);
}

export function tagCollapseMaxDistinct(
  level: GridCompressionLevel,
  urlCount: number,
  maxUrlsPerPost: GridMaxUrlsPerPost,
): number {
  return targetGridParentTagCount(level, urlCount, maxUrlsPerPost);
}

export function tagCollapseTargetParentCount(
  level: GridCompressionLevel,
  urlCount: number,
  maxUrlsPerPost: GridMaxUrlsPerPost,
): string {
  const n = targetGridParentTagCount(level, urlCount, maxUrlsPerPost);
  return String(n);
}

export function shouldUsePrefilledGridGroups(
  compression: GridCompressionLevel,
): boolean {
  return compression === "none";
}

/** Bucket key for packing clusters under a compression level. */
export function compressionClusterKey(
  row: SitemapOptimizerPostRow,
  level: GridCompressionLevel,
): string {
  if (isCompanyNewsRow(row)) return "topic:company";
  const geo = effectiveGridGeoForRow(row);
  const topic = normalizeGridTopicTag(row.gridTopicTag ?? "untagged");
  if (level === "aggressive") {
    if (geo) return `geo:${geo}`;
    const intent = row.gridIntent ?? "mixed";
    return `intent:${intent}`;
  }
  if (level === "moderate" && geo) return `geo:${geo}|topic:${topic}`;
  return `topic:${topic}`;
}

const GRID_COMPANY_TAG_RULE = `
- Firm/company news (welcome, new partner, promotion, award, milestone, careers, community): topicTag "company", tagLabel "Company". Do not tag tax guides or budget posts as company.`;

export function gridUrlTagCompressionRules(level: GridCompressionLevel): string {
  if (level === "none") {
    return `
Compression mode (basic):${GRID_COMPANY_TAG_RULE}
- Only group URLs that are directly related — use the same topicTag only when they clearly belong to one blog.
- Do not broaden tags across different intents; keep slug-level precision unless URLs are near-duplicates.`;
  }
  if (level === "moderate") {
    return `
Compression mode (moderate):${GRID_COMPANY_TAG_RULE}
- Reuse topic tags aggressively so related URLs consolidate (target 35-50 parent tags for the upload).
- Local URLs in the same city/region should share one topicTag when they serve the same audience (e.g. all Yellowknife business URLs → yellowknife_business).
- Keep clearly different intents separate (QuickBooks vs grants vs tax rates).`;
  }
  return `
Compression mode (aggressive):${GRID_COMPANY_TAG_RULE}
- Minimize the number of new posts. Target roughly upload_row_count ÷ max_urls_per_post parent topic tags (often ~15-80 for large sheets).
- When a URL is clearly local (city/region in slug or title), set geoTag and use ONE shared topicTag for all URLs in that geo (e.g. every Yellowknife URL → topicTag yellowknife_business, geoTag yellowknife).
- Merge near-duplicate themes (profit, efficiency, coaching, roadmap for the same geo → same tag).
- Prefer fewer, broader tags over granular slug-level tags.`;
}
