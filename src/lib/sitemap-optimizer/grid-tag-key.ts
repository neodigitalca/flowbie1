import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export function normalizeGridTopicTag(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "untagged";
  return t
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "untagged";
}

export function normalizeGridGeoTag(raw: string | undefined): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "";
  return t
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

/** Bucket key: same topic + geo may cluster together; never cross this key. */
export function gridClusterGroupKey(row: Pick<SitemapOptimizerPostRow, "gridTopicTag" | "gridGeoTag">): string {
  const topic = normalizeGridTopicTag(row.gridTopicTag ?? "untagged");
  const geo = normalizeGridGeoTag(row.gridGeoTag);
  return geo ? `${topic}|${geo}` : `${topic}|global`;
}
