import { normalizeGridGeoTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** City/region tokens commonly present in KWB-style blog slugs (word-boundary match). */
const GEO_SLUG_TOKENS = [
  "yellowknife",
  "edmonton",
  "calgary",
  "vancouver",
  "toronto",
  "winnipeg",
  "saskatoon",
  "regina",
  "ottawa",
  "montreal",
  "halifax",
  "victoria",
  "kelowna",
  "alberta",
  "ontario",
  "quebec",
  "manitoba",
  "saskatchewan",
  "british_columbia",
  "northwest_territories",
  "nwt",
] as const;

function haystackForRow(row: SitemapOptimizerPostRow): string {
  return [row.url, row.gridRedirectFromUrl, row.title, row.gridTagLabel]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Best-effort geo from URL/title when CSV/AI did not set geo_tag. */
export function inferGridGeoFromRow(row: SitemapOptimizerPostRow): string {
  const hay = haystackForRow(row).replace(/[^a-z0-9]+/g, " ");
  for (const token of GEO_SLUG_TOKENS) {
    const needle = token.replace(/_/g, " ");
    if (hay.includes(needle) || hay.includes(token.replace(/_/g, ""))) {
      return normalizeGridGeoTag(token);
    }
  }
  return "";
}

export function effectiveGridGeoForRow(row: SitemapOptimizerPostRow): string {
  return normalizeGridGeoTag(row.gridGeoTag ?? "") || inferGridGeoFromRow(row);
}
