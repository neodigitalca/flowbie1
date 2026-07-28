import {
  SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT,
  SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_TIGHTEN_CLUSTER_THRESHOLD,
} from "@/lib/sitemap-optimizer/constants";

/** Shared precision rules for cluster, validate, singleton sweep, and tighten agents. */
export const SITEMAP_OPTIMIZER_MERGE_PRECISION_RULES = `
Merge precision (critical):
- Cluster only **direct cannibalization**: same searcher need, same primary keyword theme, same geo when the page is local.
- **Typical cluster size: ${SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE}-${SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE} posts.** Hard ceiling ${SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE}; never use the ceiling to build umbrella groups.
- **Do NOT** merge because posts share an industry (e.g. all "blinds" or all "Edmonton area"). That is too broad.
- **ONE city or town per cluster.** Never combine Stony Plain, Spruce Grove, Leduc, St Albert, Devon, Edmonton, etc. in one merge. Different local landing slugs = different clusters or singletons.
- Multi-city titles like "Stony Plain, Spruce Grove, Devon blinds" are invalid: split into per-city groups or singletons.
- **Do NOT** merge different page types: repair guide + product/style guide + restaurant/commercial + event/promo + history/evergreen topic.
- **Do** merge: near-duplicate titles, same slug theme, same city + same service (e.g. two "blind repair edmonton" posts).
- When unsure, **smaller cluster or singleton** beats an oversized merge.
- Clusters with more than ${SITEMAP_OPTIMIZER_TIGHTEN_CLUSTER_THRESHOLD} members are almost always wrong unless titles/URLs are near-identical duplicates.
`.trim();

export function clusterSystemRulesPreamble(): string {
  return `You are a senior SEO content strategist auditing a WordPress site for overlapping blog content.

Your job: group URLs that should merge into ONE new consolidated article (near-duplicates or direct cannibalization only).

${SITEMAP_OPTIMIZER_MERGE_PRECISION_RULES}

Additional rules:`;
}

export function gscUnderperformerClusterPreamble(): string {
  return `You are a senior SEO strategist grouping **underperforming** URLs (already flagged by GSC triage) into consolidation clusters.

Your job: create **one replacement post per city or town**. Pack only same-city thin duplicates together (**maximum ${SITEMAP_OPTIMIZER_ENTITY_MAX_REDIRECTS_PER_REPLACEMENT} legacy URLs per replacement post**). Never combine unrelated suburbs into one metro page.

${SITEMAP_OPTIMIZER_MERGE_PRECISION_RULES}

Additional rules:`;
}
