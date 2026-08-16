/**
 * Sitemap inventory: plain newline-separated URL list (one published URL per line).
 * GSC exports: plain newline-separated keyword list.
 */

import {
  isInventoryExcludedSitemapUrl,
} from "@/lib/bulk/inventory-url-filter";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function inventoryFieldString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function decodeInventoryTitleText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

export function inventoryUrlForRow(row: { url?: unknown; link?: unknown }): string {
  const url = inventoryFieldString(row.url) || inventoryFieldString(row.link);
  if (!url || isInventoryExcludedSitemapUrl(url)) return "";
  return url;
}

export function compactInventoryUrlsForJson(rows: Array<{ url?: string }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const url = inventoryUrlForRow(row);
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

export function stringifyInventoryUrlList(urls: string[]): string {
  return urls.join("\n");
}

/** Plain text: one published URL per line (sitemap buckets). */
/** Content bucket artifact: structured posts only (no duplicate URL list). */
export function stringifyContentBucketPostsJson(
  source: string,
  rows: Array<{
    id?: number;
    slug?: string;
    title?: string;
    url?: string;
    link?: string;
    fields?: { title?: string };
  }>,
): string {
  const seen = new Set<string>();
  const posts: Array<{ id: number; slug: string; title: string; link: string }> = [];
  for (const row of rows) {
    const link = inventoryUrlForRow(row);
    if (!link) continue;
    const key = link.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({
      id: typeof row.id === "number" && Number.isFinite(row.id) ? row.id : 0,
      slug: inventoryFieldString(row.slug),
      title: decodeInventoryTitleText(
        inventoryFieldString(row.title) || inventoryFieldString(row.fields?.title),
      ),
      link,
    });
  }
  return JSON.stringify({ source, posts }, null, 2);
}

export function stringifyCompactInventoryJson(
  rows: Array<{ url?: string }>,
): string {
  return stringifyInventoryUrlList(compactInventoryUrlsForJson(rows));
}

export function inventoryKeywordForRow(row: {
  title?: string;
  url?: string;
  fields?: { title?: string; keyword?: string };
}): string {
  const keyword = inventoryFieldString(row.fields?.keyword);
  if (keyword) return decodeInventoryTitleText(keyword);
  return decodeInventoryTitleText(
    inventoryFieldString(row.title) || inventoryFieldString(row.fields?.title),
  );
}

export function compactInventoryKeywordsForJson(
  rows: Array<{
    title?: string;
    url?: string;
    fields?: { title?: string; keyword?: string };
  }>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const keyword = inventoryKeywordForRow(row);
    if (!keyword) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keyword);
  }
  return out;
}

export function stringifyInventoryKeywordList(keywords: string[]): string {
  return keywords.join("\n");
}

function linesFromPlainTextBlock(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Content bucket JSON: `{ source, posts: [{ id, slug, title, link }] }`. */
function parseContentBucketPostsJson(block: string): string[] {
  const parsed: unknown = JSON.parse(block);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const posts = (parsed as { posts?: unknown[] }).posts;
  if (!Array.isArray(posts)) return [];
  return compactInventoryUrlsForJson(
    posts.map((item) => {
      if (!item || typeof item !== "object") return { url: "" };
      const record = item as { url?: string; link?: string };
      return { url: record.link ?? record.url ?? "" };
    }),
  );
}

export function parseCompactInventoryUrls(block: string): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];
  if (trimmed[0] !== "{") {
    return linesFromPlainTextBlock(trimmed);
  }
  return parseContentBucketPostsJson(trimmed);
}

export function parseCompactInventoryKeywords(block: string): string[] {
  const trimmed = block.trim();
  if (!trimmed) return [];
  const first = trimmed[0];
  if (first !== "[" && first !== "{") {
    return linesFromPlainTextBlock(trimmed);
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      if (typeof parsed[0] === "string") {
        return compactInventoryKeywordsForJson(
          parsed.map((line) => ({ fields: { keyword: String(line) } })),
        );
      }
    }
    if (parsed && typeof parsed === "object") {
      const keywords = (parsed as { keywords?: unknown[] }).keywords;
      if (Array.isArray(keywords)) {
        return compactInventoryKeywordsForJson(
          keywords.map((k) => ({ fields: { keyword: String(k) } })),
        );
      }
    }
    return [];
  } catch {
    return linesFromPlainTextBlock(trimmed);
  }
}

export const parseCompactInventoryJson = parseCompactInventoryUrls;

export function stringifyInventoryJsonFromKeywords(keywords: string[]): string {
  return stringifyInventoryKeywordList(keywords);
}

/** Tuple array JSON [path, title] for KB storage. */
export function stringifyWpInventoryKbTuples(
  rows: Array<{ url?: string; fields?: { title?: string } }>,
): string {
  const tuples = rows.map((row) => {
    const url = inventoryUrlForRow(row);
    let path = url;
    try {
      path = new URL(url).pathname || url;
    } catch {
      /* keep full url */
    }
    return [path, decodeInventoryTitleText(row.fields?.title ?? "")] as [string, string];
  });
  return JSON.stringify(tuples);
}

/** @deprecated */
export type InventoryJsonRow = [path: string, title: string];

/** @deprecated */
export const inventoryJsonRowTitle = inventoryKeywordForRow;

/** @deprecated */
export const compactInventoryRowsForJson = compactInventoryUrlsForJson;

/** @deprecated */
export type SlimSiteInventoryKbPayload = {
  site: { url: string };
  generatedAt: string;
  posts: { title: string; url: string }[];
};

/** @deprecated */
export function buildSlimSiteInventoryKbPayload(
  siteUrl: string,
  rows: Array<{ url?: string; fields?: { title?: string; keyword?: string } }>,
): SlimSiteInventoryKbPayload {
  return {
    site: { url: siteUrl.trim() },
    generatedAt: new Date().toISOString(),
    posts: compactInventoryUrlsForJson(rows).map((url) => ({ title: "", url })),
  };
}
