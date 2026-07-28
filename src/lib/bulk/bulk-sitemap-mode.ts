import type { CSVRow, WordPressPostingOptions } from "@/lib/bulk-auto-generate";

export type BulkSitemapMode = "post" | "entity" | "custom";
export type BulkRowSitemapType = "post" | "entity";

const POST_ALIASES = new Set(["post", "posts", "blog", "blogs"]);
const ENTITY_ALIASES = new Set(["entity", "entities", "sap", "service-area", "servicearea"]);

/** Normalize a CSV cell or header alias value to a row sitemap type. */
export function parseBulkRowSitemapCell(raw: unknown): BulkRowSitemapType | undefined {
  if (raw == null) return undefined;
  const norm = String(raw).trim().toLowerCase().replace(/\s+/g, "");
  if (!norm) return undefined;
  if (POST_ALIASES.has(norm)) return "post";
  if (ENTITY_ALIASES.has(norm)) return "entity";
  return undefined;
}

/** Pick sitemap_type from a parsed CSV row record (header aliases). */
export function pickSitemapTypeFromRow(row: Record<string, unknown>): BulkRowSitemapType | undefined {
  for (const key of Object.keys(row)) {
    const norm = key.trim().toLowerCase().replace(/\s+/g, "");
    if (
      norm === "sitemap" ||
      norm === "sitemap_type" ||
      norm === "sitemaptype" ||
      norm === "post_destination" ||
      norm === "postdestination"
    ) {
      const parsed = parseBulkRowSitemapCell(row[key]);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

export function resolveRowSitemapType(
  siteMode: BulkSitemapMode,
  row: Pick<CSVRow, "sitemap_type">,
  fallback: BulkRowSitemapType,
): BulkRowSitemapType {
  if (siteMode === "post") return "post";
  if (siteMode === "entity") return "entity";
  return row.sitemap_type ?? fallback;
}

export function applyRowSitemapToPosting(
  posting: WordPressPostingOptions | undefined,
  rowType: BulkRowSitemapType,
): WordPressPostingOptions | undefined {
  if (!posting) return posting;
  return {
    ...posting,
    sitemapType: rowType,
    sites: posting.sites?.map((s) => ({ ...s, sitemapType: rowType })),
  };
}

export function seedCustomRowSitemaps(
  rows: CSVRow[],
  defaultType: BulkRowSitemapType,
): CSVRow[] {
  return rows.map((row) =>
    row.sitemap_type ? row : { ...row, sitemap_type: defaultType },
  );
}

export function inferBulkSitemapModeFromRows(rows: CSVRow[]): {
  mode: BulkSitemapMode;
  rows: CSVRow[];
} {
  const normalized = rows.map((row) => {
    const fromField = row.sitemap_type;
    return fromField ? row : row;
  });

  const explicitTypes = normalized
    .map((r) => r.sitemap_type)
    .filter((t): t is BulkRowSitemapType => t === "post" || t === "entity");

  if (explicitTypes.length === 0) {
    return { mode: "post", rows: normalized };
  }

  const unique = new Set(explicitTypes);
  if (unique.size === 1) {
    return { mode: explicitTypes[0]!, rows: normalized };
  }

  return { mode: "custom", rows: normalized };
}

export function postingSitemapPlaceholder(siteMode: BulkSitemapMode): BulkRowSitemapType {
  return siteMode === "entity" ? "entity" : "post";
}

export function resolveSiteSitemapMode(
  siteConfigs: Record<string, { sitemapType: BulkSitemapMode }>,
  selectedWordPressSites: ReadonlySet<string>,
  entityAvailable?: boolean,
): BulkSitemapMode {
  const siteId = Array.from(selectedWordPressSites)[0];
  const configured = siteId ? siteConfigs[siteId]?.sitemapType : undefined;
  return configured ?? (entityAvailable ? "entity" : "post");
}

export function buildCustomModePrefetchSites(
  posting: WordPressPostingOptions,
  rows: CSVRow[],
  fallback: BulkRowSitemapType,
): Array<{ site: WordPressPostingOptions["site"]; sitemapType: BulkRowSitemapType }> {
  const baseSites = posting.sites?.length
    ? posting.sites.map((s) => s.site)
    : posting.site
      ? [posting.site]
      : [];
  if (baseSites.length === 0) return [];

  const rowTypes = new Set<BulkRowSitemapType>();
  for (const row of rows) {
    rowTypes.add(resolveRowSitemapType("custom", row, fallback));
  }

  const seen = new Set<string>();
  const out: Array<{ site: WordPressPostingOptions["site"]; sitemapType: BulkRowSitemapType }> = [];
  for (const site of baseSites) {
    for (const sitemapType of rowTypes) {
      const key = `${site.id}:${sitemapType}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ site, sitemapType });
    }
  }
  return out;
}

export function csvRowsHaveExplicitSitemap(rows: CSVRow[]): boolean {
  return rows.some((r) => r.sitemap_type === "post" || r.sitemap_type === "entity");
}
