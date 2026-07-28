import type {
  SitemapOptimizerCatalogEntry,
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
} from "@/lib/sitemap-optimizer/types";

/** Slug tokens that are service/topic words, not city/town names. */
const SERVICE_SLUG_TOKENS = new Set([
  "alta",
  "and",
  "arched",
  "best",
  "blind",
  "blinds",
  "blog",
  "commercial",
  "common",
  "comparison",
  "comprehensive",
  "control",
  "covering",
  "coverings",
  "douglas",
  "energy",
  "enhance",
  "event",
  "expert",
  "fast",
  "fix",
  "for",
  "gallery",
  "grand",
  "guide",
  "half",
  "history",
  "home",
  "honeycomb",
  "hunter",
  "in",
  "installation",
  "issues",
  "local",
  "motorized",
  "night",
  "origins",
  "perfect",
  "remote",
  "reopening",
  "repair",
  "restaurant",
  "roman",
  "roller",
  "save",
  "shades",
  "smart",
  "solutions",
  "style",
  "styles",
  "the",
  "to",
  "top",
  "trends",
  "treatments",
  "vip",
  "vs",
  "window",
  "windows",
  "your",
]);

function splitSlugParts(tail: string): string[] {
  return tail
    .trim()
    .toLowerCase()
    .replace(/\/$/, "")
    .split("-")
    .filter(Boolean);
}

/**
 * Leading place key from URL slug (e.g. stony-plain, spruce-grove, st-albert).
 * Returns null when the slug starts with service words (repair guides, product pages).
 */
export function leadingPlaceKeyFromPathTail(urlPathTail: string): string | null {
  const parts = splitSlugParts(urlPathTail);
  const geo: string[] = [];
  for (const p of parts) {
    if (SERVICE_SLUG_TOKENS.has(p)) break;
    geo.push(p);
  }
  return geo.length > 0 ? geo.join("-") : null;
}

function clusterHasMultipleTowns(
  cluster: SitemapOptimizerCluster,
  catalogById: Map<string, SitemapOptimizerCatalogEntry>,
): boolean {
  const placeKeys = new Set<string>();
  for (const id of cluster.memberPostIds) {
    const entry = catalogById.get(id);
    if (!entry) continue;
    const key = leadingPlaceKeyFromPathTail(entry.urlPathTail);
    if (key) placeKeys.add(key);
  }
  return placeKeys.size >= 2;
}

/**
 * Break clusters that combine different city/town local landings (e.g. Stony Plain + Spruce Grove).
 */
export function enforceSeparateGeoClusters(
  result: SitemapOptimizerClusterResult,
  catalog: SitemapOptimizerCatalogEntry[],
): SitemapOptimizerClusterResult {
  const catalogById = new Map(catalog.map((c) => [c.postId, c]));
  const clusters: SitemapOptimizerCluster[] = [];
  const singletonSet = new Set(result.singletons);

  for (const c of result.clusters) {
    if (clusterHasMultipleTowns(c, catalogById)) {
      for (const id of c.memberPostIds) singletonSet.add(id);
      continue;
    }
    clusters.push(c);
  }

  const assigned = new Set(clusters.flatMap((c) => c.memberPostIds));
  for (const id of assigned) singletonSet.delete(id);

  return { clusters, singletons: [...singletonSet] };
}
