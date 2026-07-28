import {
  SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE,
  SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE,
} from "@/lib/sitemap-optimizer/constants";

export const GRID_CSV_CLUSTER_PRECISION_RULES = `
Grid CSV harness (new post ideas, not WordPress merges):
- Each row is a GSC URL signal for a **future blog post**, not an existing post to edit.
- Cluster URLs that should become **one new article idea** (same searcher need, same topic, same geo when local).
- Typical cluster size: ${SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE}-${SITEMAP_OPTIMIZER_PREFERRED_MAX_MERGE_GROUP_SIZE} URLs per new blog.
- Hard ceiling ${SITEMAP_OPTIMIZER_MAX_MERGE_GROUP_SIZE}; never build umbrella topic groups.
- ONE city or town per cluster for local URLs.
- When unsure, singleton (one URL = one new blog idea) beats a weak multi-URL cluster.
`.trim();

export function gridCsvClusterSystemRulesPreamble(): string {
  return `You are a senior SEO strategist planning **new cluster-optimized blog posts** from a GSC URL grid.

Your job: group URLs that should be covered by **one new article** (overlap / cannibalization / same intent).

${GRID_CSV_CLUSTER_PRECISION_RULES}

Additional rules:`;
}
