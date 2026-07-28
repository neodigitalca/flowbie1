import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";
import {
  lookupInventoryRowWithSource,
  type BulkOptimizerInventorySnapshot,
  type InventoryLookupMaps,
} from "@/lib/wordpress-api/inventory-match";
import { filterOverviewUtilityInventoryRows, isOverviewUtilityPage } from "@/lib/overview/overview-utility-page-filter";

/** Inventory row tagged with REST collection (for binding subtype / endpoint). */
export type OverviewInventoryRow = SitePostInventoryRow & {
  collection: string;
};

function csvEscape(value: string): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function acfCell(acf: Record<string, unknown> | undefined, ...keys: string[]): string {
  if (!acf || typeof acf !== "object") return "";
  for (const k of keys) {
    const v = acf[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
}

/**
 * Merge published posts + pages inventory API responses into tagged rows.
 */
export function mergeOverviewInventoryRows(
  posts: SitePostInventoryRow[],
  pages: SitePostInventoryRow[],
): OverviewInventoryRow[] {
  const out: OverviewInventoryRow[] = [];
  for (const r of posts) {
    out.push({ ...r, collection: "posts" });
  }
  for (const r of pages) {
    out.push({ ...r, collection: "pages" });
  }
  return out;
}

/** True if bulk inventory already includes extra_text / seo_extra_text ACF keys (no discover endpoint). */
export function inventoryRowsSupportSeoExtraText(rows: OverviewInventoryRow[]): boolean {
  for (const r of rows) {
    const acf = r.acf && typeof r.acf === "object" ? (r.acf as Record<string, unknown>) : null;
    if (!acf) continue;
    if ("extra_text" in acf || "seo_extra_text" in acf) return true;
  }
  return false;
}

const CSV_HEADERS = [
  "id",
  "url",
  "slug",
  "collection",
  "title",
  "date_gmt",
  "keyword",
  "acf_meta_summary",
  "excerpt_plain",
  "acf_faq",
  "acf_date_modifier",
  "acf_seo_date_modifier",
  "acf_seo_research",
  "acf_keyword_focus",
] as const;

/** UTF-8 BOM + CRLF for Excel; suitable for sheet importers and local cache. */
export function buildOverviewInventoryCsv(
  rows: OverviewInventoryRow[],
  _siteUrl: string,
): string {
  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    const acf = r.acf && typeof r.acf === "object" ? (r.acf as Record<string, unknown>) : undefined;
    const line = [
      csvEscape(r.id != null ? String(r.id) : ""),
      csvEscape(r.url ?? ""),
      csvEscape(r.slug ?? ""),
      csvEscape(r.collection),
      csvEscape(r.fields?.title ?? ""),
      csvEscape(r.date_gmt ?? ""),
      csvEscape(r.fields?.keyword ?? ""),
      csvEscape(r.fields?.meta ?? ""),
      csvEscape(r.fields?.excerpt ?? ""),
      csvEscape(acfCell(acf, "faq")),
      csvEscape(acfCell(acf, "date_modifier")),
      csvEscape(acfCell(acf, "seo_date_modifier")),
      csvEscape(acfCell(acf, "seo_research")),
      csvEscape(acfCell(acf, "keyword_focus")),
    ];
    lines.push(line.join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

const SITEMAP_EXPORT_HEADERS = ["url", "title", "meta"] as const;

/** WordPress sitemap export: URL + title + meta only (no GSC or ACF research fields). */
export function buildWordPressSitemapExportCsv(
  rows: OverviewInventoryRow[],
  _siteUrl: string,
): string {
  const lines: string[] = [SITEMAP_EXPORT_HEADERS.join(",")];
  for (const r of rows) {
    const rawTitle = (r.fields?.title ?? "").trim();
    const title = rawTitle
      .replace(/&#0*38;/gi, "&")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;/gi, "'");
    const meta = (r.fields?.meta ?? r.fields?.excerpt ?? "").trim();
    lines.push(
      [csvEscape(r.url ?? ""), csvEscape(title), csvEscape(meta)].join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

/** One inventory row per sitemap URL, matched from bulk snapshot (unmatched URLs get URL-only stub rows). */
export function buildOverviewSitemapUrlsInventoryCsv(
  sitemapUrls: string[],
  siteUrl: string,
  snapshot: BulkOptimizerInventorySnapshot,
): string {
  const rows: OverviewInventoryRow[] = [];
  for (const url of sitemapUrls) {
    if (isOverviewUtilityPage({ url })) continue;
    const hit = lookupInventoryRowWithSource(snapshot, siteUrl, url, "other");
    if (hit?.row?.id) {
      rows.push({ ...hit.row, collection: hit.source });
      continue;
    }
    rows.push({
      id: 0,
      url,
      slug: "",
      collection: "unmatched",
      fields: { title: "", keyword: "", meta: "", content: "", excerpt: "" },
      date_gmt: "",
    });
  }
  return buildWordPressSitemapExportCsv(filterOverviewUtilityInventoryRows(rows), siteUrl);
}

export function overviewRowsFromInventoryMaps(
  maps: InventoryLookupMaps,
  collection: "posts" | "pages",
): OverviewInventoryRow[] {
  const rows: OverviewInventoryRow[] = [];
  for (const row of maps.byLink.values()) {
    rows.push({ ...row, collection });
  }
  const filtered = collection === "pages" ? filterOverviewUtilityInventoryRows(rows) : rows;
  filtered.sort((a, b) => (a.url ?? "").localeCompare(b.url ?? ""));
  return filtered;
}

function inventoryCsvToHarnessMarkdown(csv: string): string {
  const body = csv.replace(/^\uFEFF/, "");
  return `\`\`\`csv\n${body}\n\`\`\``;
}

export function buildInventoryBucketHarnessMarkdown(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
  bucket: "posts" | "pages",
): string {
  const maps = bucket === "posts" ? snapshot.postsMaps : snapshot.pagesMaps;
  return inventoryCsvToHarnessMarkdown(
    buildWordPressSitemapExportCsv(overviewRowsFromInventoryMaps(maps, bucket), siteUrl),
  );
}

export function buildEntityBucketHarnessMarkdown(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
): string {
  const rows: OverviewInventoryRow[] = [];
  for (const [collection, maps] of Object.entries(snapshot.customMapsByCollection ?? {})) {
    for (const row of maps.byLink.values()) {
      rows.push({ ...row, collection });
    }
  }
  rows.sort((a, b) => (a.url ?? "").localeCompare(b.url ?? ""));
  return inventoryCsvToHarnessMarkdown(buildWordPressSitemapExportCsv(rows, siteUrl));
}

export function buildMergedInventoryHarnessMarkdown(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
): string {
  const posts = overviewRowsFromInventoryMaps(snapshot.postsMaps, "posts");
  const pages = overviewRowsFromInventoryMaps(snapshot.pagesMaps, "pages");
  return inventoryCsvToHarnessMarkdown(buildWordPressSitemapExportCsv([...posts, ...pages], siteUrl));
}
