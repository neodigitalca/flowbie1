import type { SitePostInventoryRow } from "./types";

/** Ignore HTML-only noise when deciding if bulk inventory already has enough body to skip get-post-content. */
const MIN_INVENTORY_BODY_PLAIN_CHARS = 24;

function inventoryPlainTextLength(html: string): number {
  if (!html || typeof html !== "string") return 0;
  const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return plain.length;
}

/**
 * True when inventory row has id and non-trivial content or excerpt (plain text length after stripping tags).
 * Avoids treating empty `<p></p>` or whitespace-only REST bodies as a prefetch hit.
 */
export function inventoryRowHasUsableBodyContent(row: SitePostInventoryRow | undefined): boolean {
  if (!row?.id) return false;
  const cLen = inventoryPlainTextLength(String(row.fields?.content ?? ""));
  const eLen = inventoryPlainTextLength(String(row.fields?.excerpt ?? ""));
  return cLen >= MIN_INVENTORY_BODY_PLAIN_CHARS || eLen >= MIN_INVENTORY_BODY_PLAIN_CHARS;
}

/** True when inventory has a full post body (`fields.content`), not excerpt-only. */
export function inventoryRowHasFullPostContent(row: SitePostInventoryRow | undefined): boolean {
  if (!row?.id) return false;
  return inventoryPlainTextLength(String(row.fields?.content ?? "")) >= MIN_INVENTORY_BODY_PLAIN_CHARS;
}

/**
 * True when inventory has enough metadata for bulk prefetch / keyword research without get-post-content.
 * (Title, keyword, ACF keyword_focus, or slug — body optional.)
 */
export function inventoryRowHasUsablePrefetchData(row: SitePostInventoryRow | undefined): boolean {
  if (!row?.id) return false;
  const title = String(row.fields?.title ?? "").trim();
  const keyword = String(row.fields?.keyword ?? "").trim();
  const slug = String(row.slug ?? "").trim();
  const acfKw = String(
    (row.acf && typeof row.acf === "object" ? (row.acf as Record<string, unknown>)["keyword_focus"] : "") ??
      "",
  ).trim();
  return title.length > 0 || keyword.length > 0 || acfKw.length > 0 || slug.length > 0;
}

function inventoryPostTypeSubtype(endpoint: InventoryRowSource): string {
  if (endpoint === "pages") return "page";
  if (endpoint === "posts") return "post";
  return endpoint;
}

/** Build existingPost shape for bulk prefetch from inventory (correct wp/v2 collection). */
export function existingPostFromInventoryRow(
  invHit: { row: SitePostInventoryRow; source: InventoryRowSource },
): Record<string, unknown> {
  const { row, source } = invHit;
  const postTypeEndpoint = source;
  const postTypeSubtype = inventoryPostTypeSubtype(source);
  return {
    id: row.id,
    slug: row.slug || "",
    title: row.fields?.title ?? "",
    content: row.fields?.content ?? "",
    excerpt: row.fields?.excerpt ?? "",
    link: row.url,
    date_gmt: row.date_gmt ?? "",
    postTypeEndpoint,
    postTypeSubtype,
  };
}

/** Canonical key for inventory URL matching (www-insensitive, no trailing slash). */
function canonicalInventoryUrlKey(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${u.protocol}//${host}${path}`;
  } catch {
    return urlStr.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/** Normalized URL key for matching bulk targets to WordPress `link` (matches content-optimizer prefetch). */
export function normalizeMatch(siteBaseUrl: string, link: string): string {
  if (!link?.trim()) return "";
  try {
    const base = (siteBaseUrl || "").trim().replace(/\/+$/, "");
    const baseUrl = base.startsWith("http") ? base : `https://${base}`;
    const full = link.startsWith("http") ? link : `${baseUrl}${link.startsWith("/") ? link : `/${link}`}`;
    return canonicalInventoryUrlKey(full);
  } catch {
    return link.toLowerCase().replace(/\/+$/, "");
  }
}

function slugKeyFromPathname(pathname: string): string {
  const parts = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "";
  return last.replace(/\.(html?|php)$/i, "").toLowerCase();
}

function slugFromRowUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return slugKeyFromPathname(u.pathname);
  } catch {
    return slugKeyFromPathname(String(urlStr));
  }
}

export function slugKeyFromTargetUrl(siteUrl: string, targetUrl: string): string {
  try {
    const base = (siteUrl || "").trim().replace(/\/+$/, "");
    const baseUrl = base.startsWith("http") ? base : `https://${base}`;
    const full = targetUrl.startsWith("http")
      ? targetUrl
      : `${baseUrl}${targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`}`;
    const u = new URL(full);
    return slugKeyFromPathname(u.pathname);
  } catch {
    const last = String(targetUrl).split("/").filter(Boolean).pop() || "";
    return last.replace(/\.(html?|php)$/i, "").toLowerCase();
  }
}

export function buildInventoryLookupMaps(
  rows: SitePostInventoryRow[],
  siteUrl: string,
): { bySlug: Map<string, SitePostInventoryRow>; byLink: Map<string, SitePostInventoryRow> } {
  const bySlug = new Map<string, SitePostInventoryRow>();
  const byLink = new Map<string, SitePostInventoryRow>();
  for (const row of rows) {
    const sk = row.slug?.trim() ? row.slug.trim().toLowerCase() : slugFromRowUrl(row.url);
    if (sk) {
      bySlug.set(sk, row);
    }
    const lk = normalizeMatch(siteUrl, row.url);
    if (lk) {
      byLink.set(lk, row);
    }
  }
  return { bySlug, byLink };
}

export type InventoryLookupMaps = ReturnType<typeof buildInventoryLookupMaps>;

export type BulkOptimizerInventorySnapshot = {
  postsMaps: InventoryLookupMaps;
  pagesMaps: InventoryLookupMaps;
  /** Custom CPT inventories keyed by wp/v2 collection (e.g. service-area). */
  customMapsByCollection?: Record<string, InventoryLookupMaps>;
};

function inventoryMapsHasEntries(maps: InventoryLookupMaps | undefined): boolean {
  if (!maps) return false;
  return maps.byLink.size > 0 || maps.bySlug.size > 0;
}

export function mergeInventoryLookupMaps(
  a: InventoryLookupMaps,
  b: InventoryLookupMaps,
): InventoryLookupMaps {
  const bySlug = new Map(a.bySlug);
  for (const [key, row] of b.bySlug) bySlug.set(key, row);
  const byLink = new Map(a.byLink);
  for (const [key, row] of b.byLink) byLink.set(key, row);
  return { bySlug, byLink };
}

export function mergeBulkOptimizerInventorySnapshots(
  ...snapshots: BulkOptimizerInventorySnapshot[]
): BulkOptimizerInventorySnapshot | null {
  const valid = snapshots.filter((snap) => snapshotHasInventoryEntries(snap));
  if (!valid.length) return null;
  let merged = valid[0]!;
  for (let i = 1; i < valid.length; i += 1) {
    const snap = valid[i]!;
    const customMapsByCollection: Record<string, InventoryLookupMaps> = {
      ...(merged.customMapsByCollection ?? {}),
    };
    for (const [coll, maps] of Object.entries(snap.customMapsByCollection ?? {})) {
      customMapsByCollection[coll] = customMapsByCollection[coll]
        ? mergeInventoryLookupMaps(customMapsByCollection[coll], maps)
        : maps;
    }
    merged = {
      postsMaps: mergeInventoryLookupMaps(merged.postsMaps, snap.postsMaps),
      pagesMaps: mergeInventoryLookupMaps(merged.pagesMaps, snap.pagesMaps),
      ...(Object.keys(customMapsByCollection).length > 0 ? { customMapsByCollection } : {}),
    };
  }
  return merged;
}

export function snapshotHasInventoryEntries(snapshot: BulkOptimizerInventorySnapshot): boolean {
  return (
    inventoryMapsHasEntries(snapshot.postsMaps) ||
    inventoryMapsHasEntries(snapshot.pagesMaps) ||
    Object.values(snapshot.customMapsByCollection ?? {}).some(inventoryMapsHasEntries)
  );
}

export type BulkInventoryTypeHint = "post" | "page" | "other";

export function typeHintFromCachedPost(cached: { postType?: string } | null | undefined): BulkInventoryTypeHint {
  if (!cached?.postType) return "other";
  if (cached.postType === "page") return "page";
  if (cached.postType === "post") return "post";
  return "other";
}

export function lookupInMaps(
  maps: { bySlug: Map<string, SitePostInventoryRow>; byLink: Map<string, SitePostInventoryRow> },
  siteUrl: string,
  targetUrl: string,
): SitePostInventoryRow | undefined {
  const norm = normalizeMatch(siteUrl, targetUrl);
  const linkHit = maps.byLink.get(norm);
  if (linkHit) return linkHit;
  const sk = slugKeyFromTargetUrl(siteUrl, targetUrl);
  if (sk) return maps.bySlug.get(sk);
  return undefined;
}

export function lookupInventoryRow(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
  targetUrl: string,
  typeHint: BulkInventoryTypeHint,
): SitePostInventoryRow | undefined {
  const hit = lookupInventoryRowWithSource(snapshot, siteUrl, targetUrl, typeHint);
  return hit?.row;
}

export type InventoryRowSource = "posts" | "pages" | string;

/** Same matching as lookupInventoryRow but records which wp/v2 collection matched. */
export function lookupInventoryRowWithSource(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
  targetUrl: string,
  typeHint: BulkInventoryTypeHint,
): { row: SitePostInventoryRow; source: InventoryRowSource } | undefined {
  const custom = snapshot.customMapsByCollection ?? {};
  const customKeys = Object.keys(custom);

  // CPT sitemap URLs: match custom collections by link before posts/pages slug fallback.
  if (typeHint === "other" && customKeys.length > 0) {
    for (const coll of customKeys) {
      const row = lookupInMaps(custom[coll], siteUrl, targetUrl);
      if (row) return { row, source: coll };
    }
  }

  const tryOrder: InventoryRowSource[] =
    typeHint === "page"
      ? ["pages", "posts"]
      : typeHint === "post"
        ? ["posts", "pages"]
        : ["posts", "pages"];

  for (const which of tryOrder) {
    const maps = which === "pages" ? snapshot.pagesMaps : snapshot.postsMaps;
    const row = lookupInMaps(maps, siteUrl, targetUrl);
    if (row) return { row, source: which };
  }

  if (typeHint !== "other") {
    for (const coll of customKeys) {
      const row = lookupInMaps(custom[coll], siteUrl, targetUrl);
      if (row) return { row, source: coll };
    }
  }

  return undefined;
}
