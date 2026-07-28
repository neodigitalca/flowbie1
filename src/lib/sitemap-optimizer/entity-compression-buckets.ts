import type { GridCompressionLevel } from "@/lib/sitemap-optimizer/grid-compression-policy";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

/** Metro anchors used to group suburbs under aggressive entity compression. */
const METRO_ANCHORS: ReadonlyArray<{ metro: string; tokens: readonly string[] }> = [
  {
    metro: "winnipeg",
    tokens: [
      "winnipeg",
      "charleswood",
      "transcona",
      "st-vital",
      "st-vitals",
      "fort-garry",
      "river-heights",
      "tuxedo",
      "assiniboine",
      "westwood",
      "west-kildonan",
      "east-kildonan",
      "north-kildonan",
      "southland",
      "lindenwoods",
      "bridgwater",
      "whyteridge",
      "crescentwood",
      "osborne",
      "fort-rouge",
      "st-boniface",
      "st-james",
      "elmwood",
      "inkster",
      "brookside",
    ],
  },
  {
    metro: "brandon",
    tokens: ["brandon", "shilo", "wawanesa"],
  },
  {
    metro: "edmonton",
    tokens: [
      "edmonton",
      "st-albert",
      "stony-plain",
      "spruce-grove",
      "leduc",
      "sherwood-park",
      "fort-saskatchewan",
      "beaumont",
      "devon",
    ],
  },
  {
    metro: "calgary",
    tokens: ["calgary", "airdrie", "cochrane", "okotoks", "chestermere"],
  },
];

const PRODUCT_THEME_TOKENS: ReadonlyArray<{ theme: string; tokens: readonly string[] }> = [
  { theme: "blinds", tokens: ["blind", "blinds", "venetian", "vertical"] },
  { theme: "shades", tokens: ["shade", "shades", "roller", "roman", "cellular", "honeycomb", "luminette", "silhouette"] },
  { theme: "drapery", tokens: ["drapery", "draperies", "curtain", "curtains", "sheer"] },
  { theme: "motorized", tokens: ["motorized", "motorisation", "automation", "smart"] },
];

const SERVICE_AREA_SEGMENT_MARKERS = ["service-area", "service_area", "service-areas", "service_areas"];

function haystackForEntityRow(row: SitemapOptimizerPostRow): string {
  return [row.url, row.title, row.slug, row.keyword]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Location slug after /service-area/ (or last path segment fallback). */
export function entityLocationSlugFromRow(row: SitemapOptimizerPostRow): string {
  const url = row.url?.trim();
  if (!url) return "";
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const markerIdx = segments.findIndex((seg) =>
      SERVICE_AREA_SEGMENT_MARKERS.some((m) => seg.toLowerCase().includes(m)),
    );
    if (markerIdx >= 0 && markerIdx < segments.length - 1) {
      return segments.slice(markerIdx + 1).join("/").toLowerCase();
    }
    return segments.length ? segments[segments.length - 1]!.toLowerCase() : "";
  } catch {
    return "";
  }
}

function tokenInHaystack(hay: string, token: string): boolean {
  const normalized = token.replace(/-/g, " ");
  return hay.includes(token) || hay.includes(normalized);
}

export function entityMetroAnchorFromRow(row: SitemapOptimizerPostRow): string {
  const hay = haystackForEntityRow(row);
  const slug = entityLocationSlugFromRow(row);
  const combined = `${hay} ${slug}`.trim();

  for (const { metro, tokens } of METRO_ANCHORS) {
    for (const token of tokens) {
      if (tokenInHaystack(combined, token)) return metro;
    }
  }

  const slugParts = slug.split("/").filter(Boolean);
  if (slugParts.length > 0) {
    const first = slugParts[0]!.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (first.length >= 3) return first;
  }

  return "general";
}

export function entityProductThemeFromRow(row: SitemapOptimizerPostRow): string {
  const hay = haystackForEntityRow(row);
  for (const { theme, tokens } of PRODUCT_THEME_TOKENS) {
    for (const token of tokens) {
      if (tokenInHaystack(hay, token)) return theme;
    }
  }
  return "general";
}

/** Bucket key for packing entity rows under a compression level. */
export function entityCompressionBucketKey(
  row: SitemapOptimizerPostRow,
  level: GridCompressionLevel,
  allowMetroMerge: boolean,
): string {
  const locationSlug = entityLocationSlugFromRow(row);
  const metro = entityMetroAnchorFromRow(row);
  const theme = entityProductThemeFromRow(row);

  if (level === "aggressive" && allowMetroMerge) {
    return `metro:${metro}`;
  }
  if (level === "moderate") {
    return `metro:${metro}|theme:${theme}`;
  }
  if (locationSlug) {
    return `place:${locationSlug}`;
  }
  return `metro:${metro}|theme:${theme}`;
}

export function entityPillarSortKey(row: SitemapOptimizerPostRow): number {
  const clicks = row.gscPageClicks ?? 0;
  const impressions = row.gscPageImpressions ?? 0;
  return clicks * 1_000_000 + impressions;
}
