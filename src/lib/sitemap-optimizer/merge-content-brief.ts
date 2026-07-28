import type { SitemapOptimizerMergeRecommendation } from "@/lib/sitemap-optimizer/types";

/**
 * Bulk harness / content upload brief: intent + H2 sections + coverage topics.
 * No merge/consolidation language.
 */
export function buildMergeContentModifier(merge: SitemapOptimizerMergeRecommendation): string {
  const parts: string[] = [];

  const keyword = merge.recommendedPrimaryKeyword.trim();
  const meta = merge.recommendedMeta.trim();
  if (keyword && meta) {
    parts.push(`Search intent: ${keyword}. ${meta}`);
  } else if (keyword) {
    parts.push(`Search intent: ${keyword}.`);
  } else if (meta) {
    parts.push(`Search intent: ${meta}`);
  }

  if (merge.combinedOutline.length > 0) {
    parts.push(`Required H2 sections: ${merge.combinedOutline.join("; ")}.`);
  }

  const topics = [
    ...new Set(
      merge.whatToKeepFromEach.flatMap((k) => k.bullets).map((b) => b.trim()).filter(Boolean),
    ),
  ];
  if (topics.length > 0) {
    parts.push(`Topics to address: ${topics.join("; ")}.`);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
