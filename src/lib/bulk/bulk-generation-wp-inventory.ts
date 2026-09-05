import type { WordPressSite } from "@/components/integrations/types";
import { INTERNAL_LINK_INTENT_ROUTING_RULE } from "@/lib/content-generation/internal-link-routing-rules";
import {
  MIN_INTERNAL_LINKS_PER_BODY_H2,
  TARGET_INTERNAL_LINKS_PER_BODY_H2,
} from "@/lib/content-generation/link-anchor-text-case";
import { overviewSitemapSourcesForSite, pageSitemapXmlUrlForPlay } from "@/lib/overview/overview-sitemap-source";
import { parseSitemap } from "@/lib/wordpress-api/connection";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import { fetchAllOverviewInventoriesParallel } from "@/lib/overview/overview-parallel-inventory-fetch";
import { ensureEntitySiteWarmCache } from "@/lib/local-analysis/entity-site-warm-cache";
import {
  clearBulkGenerationWpInventoryCache,
  getBulkGenerationWpInventoryEntry,
  getBulkGenerationWpInventoryIfReady,
  seedBulkGenerationWpInventoryFromParallel,
  seedBulkGenerationWpInventoryFromBundle,
  setBulkGenerationWpInventoryEntry,
  type BulkGenerationWpInventory,
} from "@/lib/bulk/bulk-generation-inventory-cache-store";

export {
  INTERNAL_LINK_ANCHOR_MATCH_RULE,
  INTERNAL_LINK_INTENT_ROUTING_RULE,
} from "@/lib/content-generation/internal-link-routing-rules";

export type { BulkGenerationWpInventory };
export {
  getBulkGenerationWpInventoryIfReady,
  seedBulkGenerationWpInventoryFromParallel,
  seedBulkGenerationWpInventoryFromBundle,
};

export type BulkGenerationLinkable = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
  collection?: string;
};

const PAGE_COLLECTIONS = new Set(["pages", "page"]);
const POST_COLLECTIONS = new Set(["posts", "post"]);

export function blogPlayLinkInventoryLabel(
  collection?: string,
  postType?: string,
): "PAGE" | "BLOG" {
  const bucket = (collection || postType || "").toLowerCase();
  if (POST_COLLECTIONS.has(bucket) || bucket === "post") return "BLOG";
  return "PAGE";
}

export function isBlogPlayLinkCollection(collection: string | undefined): boolean {
  const c = (collection ?? "").toLowerCase().trim();
  if (!c) return false;
  if (c === "sap" || c.includes("service-area") || c.includes("service_area") || c.includes("entity")) {
    return false;
  }
  return PAGE_COLLECTIONS.has(c) || POST_COLLECTIONS.has(c);
}

export function isServiceAreaUrl(link: string): boolean {
  const n = link.toLowerCase();
  return (
    n.includes("/service-area") ||
    n.includes("/service_area") ||
    n.includes("/service-areas") ||
    n.includes("service-area-sitemap")
  );
}

export function isBlogPlayLinkTarget(input: {
  link?: string;
  collection?: string;
  postType?: string;
}): boolean {
  const link = input.link?.trim() ?? "";
  if (!link || isServiceAreaUrl(link)) return false;
  const bucket = (input.collection || input.postType || "").toLowerCase().trim();
  if (!bucket) return true;
  if (
    bucket === "sap" ||
    bucket.includes("service-area") ||
    bucket.includes("service_area") ||
    bucket.includes("entity")
  ) {
    return false;
  }
  return (
    PAGE_COLLECTIONS.has(bucket) ||
    POST_COLLECTIONS.has(bucket) ||
    bucket === "page" ||
    bucket === "post"
  );
}

export function keepBlogPlayLinkTargets<
  T extends { link?: string; collection?: string; postType?: string },
>(items: T[]): T[] {
  return items.filter(isBlogPlayLinkTarget);
}

export function clearBulkGenerationWpInventory(siteId?: string): void {
  clearBulkGenerationWpInventoryCache(siteId);
}

export function inventoryRowsToWordPressLinkables(rows: SiteInventoryBulkRow[]): BulkGenerationLinkable[] {
  const seen = new Set<string>();
  const out: BulkGenerationLinkable[] = [];
  for (const row of rows) {
    const link = row.url?.trim();
    if (!link) continue;
    const norm = link.toLowerCase().replace(/\/+$/, "");
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push({
      id: row.id ?? 0,
      slug: row.slug ?? "",
      title: row.fields?.title ?? "",
      excerpt: row.fields?.excerpt ?? "",
      link,
      date_gmt: row.date_gmt ?? "",
      collection: row.collection,
    });
  }
  return out;
}

/** Blog Play internal links: pages sitemap first, then post sitemap. Never service-area / SAP. */
export function inventoryRowsToBlogPlayLinkables(rows: SiteInventoryBulkRow[]): BulkGenerationLinkable[] {
  const pages = rows.filter((row) => PAGE_COLLECTIONS.has((row.collection ?? "").toLowerCase()));
  const posts = rows.filter((row) => POST_COLLECTIONS.has((row.collection ?? "").toLowerCase()));
  const untyped = rows.filter((row) => {
    const c = (row.collection ?? "").trim();
    return !c && row.url?.trim() && !isServiceAreaUrl(row.url);
  });
  return inventoryRowsToWordPressLinkables([...pages, ...posts, ...untyped]);
}

function titleFromPageSitemapSlug(url: string): string {
  const slug = url.split("/").filter(Boolean).pop() ?? "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLinkKey(link: string): string {
  return link.trim().toLowerCase().replace(/\/+$/, "");
}

function isPageCollection(collection: string | undefined): boolean {
  return PAGE_COLLECTIONS.has((collection ?? "").toLowerCase());
}

/** Merge page-sitemap.xml URLs into the Play pool as pages. Pages stay first. */
export function mergePageSitemapUrlsIntoBlogPlayLinkables(
  existing: BulkGenerationLinkable[],
  pageSitemapUrls: string[],
): BulkGenerationLinkable[] {
  const byLink = new Map(existing.map((item) => [normalizeLinkKey(item.link), item]));
  const pages: BulkGenerationLinkable[] = [];
  const seen = new Set<string>();
  for (const raw of pageSitemapUrls) {
    const link = raw.trim();
    if (!link || isServiceAreaUrl(link)) continue;
    const key = normalizeLinkKey(link);
    if (seen.has(key)) continue;
    seen.add(key);
    const prior = byLink.get(key);
    pages.push({
      id: prior?.id ?? 0,
      slug: prior?.slug || (link.split("/").filter(Boolean).pop() ?? ""),
      title: prior?.title?.trim() || titleFromPageSitemapSlug(link),
      excerpt: prior?.excerpt ?? "",
      link: prior?.link || link,
      date_gmt: prior?.date_gmt ?? "",
      collection: "pages",
    });
  }
  const rest = existing.filter((item) => !seen.has(normalizeLinkKey(item.link)));
  return [...pages, ...rest];
}

export async function loadBlogPlayLinkablesForSite(
  site: WordPressSite,
  rows: SiteInventoryBulkRow[],
): Promise<BulkGenerationLinkable[]> {
  const base = inventoryRowsToBlogPlayLinkables(rows);
  const xmlUrl = pageSitemapXmlUrlForPlay(site);
  if (!xmlUrl) {
    throw new Error("page-sitemap.xml URL is missing for this WordPress site.");
  }
  const parsed = await parseSitemap(site.siteUrl, xmlUrl, site.username, site.appPassword);
  const pageUrls = parsed.urls ?? [];
  const merged = mergePageSitemapUrlsIntoBlogPlayLinkables(base, pageUrls);
  if (!merged.some((item) => isPageCollection(item.collection))) {
    throw new Error("page-sitemap.xml returned no page URLs.");
  }
  return merged;
}

export function formatBlogPlayLinkTargetsPrompt(
  posts: Array<{ title?: string; link?: string; collection?: string; postType?: string }>,
): string {
  const pages: string[] = [];
  const blogs: string[] = [];
  for (const post of posts) {
    const title = (post.title || "").replace(/"/g, "'").trim();
    const url = (post.link || "").trim();
    if (!url) continue;
    if (!isBlogPlayLinkTarget({ link: url, collection: post.collection, postType: post.postType })) continue;
    const bucket = (post.collection || post.postType || "").toLowerCase();
    const line = `- "${title}"`;
    const labeledBlog = POST_COLLECTIONS.has(bucket) || bucket === "post";
    const pathIsBlog = !bucket && url.toLowerCase().includes("/blog/");
    if (labeledBlog || pathIsBlog) blogs.push(line);
    else pages.push(line);
  }
  if (!pages.length && !blogs.length) return "";
  const pageBlock = pages.length ? `PAGES\n${pages.join("\n")}` : "";
  const blogBlock = blogs.length ? `BLOG POSTS\n${blogs.join("\n")}` : "";
  return `
=== INTERNAL LINK TARGETS (page-sitemap.xml first, then blog posts, never service-area) ===
${[pageBlock, blogBlock].filter(Boolean).join("\n\n")}
${INTERNAL_LINK_INTENT_ROUTING_RULE}
Weave that token mid-sentence. Never as the last words of a sentence. Never on bold copy.
Titles from this list only. Do not paste hrefs. URLs resolve after generation.
Forbidden: service-area, city landing, or /service-area/ URLs.
=== END INTERNAL LINK TARGETS ===`;
}

export type LinkTargetPlanEntry = {
  url: string;
  title: string;
  query: string;
  sectionHints: string[];
  suggestedAnchor?: string;
};

export type LinkTargetsPlan = {
  pageTargets: LinkTargetPlanEntry[];
  blogTargets: LinkTargetPlanEntry[];
};

export function formatLinkTargetsPlanPrompt(plan: LinkTargetsPlan): string {
  const formatEntries = (entries: LinkTargetPlanEntry[], label: string) => {
    if (!entries.length) return "";
    const lines = entries.map((entry) => {
      const hints =
        entry.sectionHints?.length > 0
          ? ` (sections: ${entry.sectionHints.join("; ")})`
          : "";
      const anchor = entry.suggestedAnchor?.trim()
        ? ` → suggested anchor "${entry.suggestedAnchor.trim()}"`
        : "";
      return `- "${entry.title}" → URL ${entry.url} → query "${entry.query}" (copy query exactly)${anchor}${hints}`;
    });
    return `${label}\n${lines.join("\n")}`;
  };
  const pageBlock = formatEntries(plan.pageTargets, "ASSIGNED PAGE LINKS (product/service/commercial)");
  const blogBlock = formatEntries(plan.blogTargets, "ASSIGNED BLOG LINKS (informational)");
  if (!pageBlock && !blogBlock) return "";
  return `
=== LINK TARGETS PLAN (predetermined — use these queries in [[LINK:query|anchor]]) ===
${[pageBlock, blogBlock].filter(Boolean).join("\n\n")}
${INTERNAL_LINK_INTENT_ROUTING_RULE}
Use ${MIN_INTERNAL_LINKS_PER_BODY_H2}-${TARGET_INTERNAL_LINKS_PER_BODY_H2} [[LINK:query|anchor]] placeholders per body H2 section. Prefer plan entries whose sectionHints match this H2 before global entries.
Copy each query string EXACTLY from this plan. Anchor must match suggested anchor casing or share words from the destination title in sentence case (brands capitalized only).
Product, service, and brand terms: use ASSIGNED PAGE LINKS queries only. Informational terms: use ASSIGNED BLOG LINKS queries only.
=== END LINK TARGETS PLAN ===`;
}

/** Pages bucket rows for entity What We Offer table linking. */
export function inventoryRowsToWordPressPagesForOffer(
  rows: SiteInventoryBulkRow[],
): BulkGenerationLinkable[] {
  return inventoryRowsToWordPressLinkables(
    rows.filter((row) => row.collection === "pages"),
  );
}

/**
 * Reads site prefetch cache first (instant when warm). Falls back to prefetch fetch only on cold miss.
 * Pass `{ force: true }` to bypass cache and re-fetch inventory (includes scheduled posts).
 */
export async function ensureBulkGenerationWpInventory(
  site: WordPressSite,
  onProgress?: (message: string) => void,
  options?: { force?: boolean },
): Promise<BulkGenerationWpInventory> {
  const force = options?.force === true;
  if (!force) {
    const existing = getBulkGenerationWpInventoryEntry(site.id);
    if (existing && !existing.error) {
      return existing;
    }
  } else {
    clearBulkGenerationWpInventory(site.id);
  }

  if (!site.siteUrl?.trim() || !site.username?.trim() || !site.appPassword?.trim()) {
    const empty: BulkGenerationWpInventory = {
      siteId: site.id,
      rows: [],
      fetchedAt: Date.now(),
      error: "WordPress site credentials are required.",
    };
    setBulkGenerationWpInventoryEntry(empty);
    return empty;
  }

  const sourceCount = overviewSitemapSourcesForSite(site).length;
  const prefetchReady = !force && getBulkGenerationWpInventoryIfReady(site.id);
  if (!prefetchReady) {
    onProgress?.(`Loading WordPress site inventory (${sourceCount} sitemap buckets in parallel)…`);
  }

  if (force && site.siteUrl?.trim() && site.username?.trim() && site.appPassword?.trim()) {
    const parallel = await fetchAllOverviewInventoriesParallel(site, {
      includeRawAcf: true,
      includeScheduled: true,
    });
    seedBulkGenerationWpInventoryFromParallel(site, parallel);
    const forced = getBulkGenerationWpInventoryEntry(site.id);
    if (forced && !forced.error) {
      return forced;
    }
  }

  const prefetch = await ensureEntitySiteWarmCache(site);
  const cached = getBulkGenerationWpInventoryEntry(site.id);
  if (cached && !cached.error) {
    return cached;
  }

  if (prefetch.error) {
    const failed: BulkGenerationWpInventory = {
      siteId: site.id,
      rows: [],
      fetchedAt: prefetch.fetchedAt,
      error: prefetch.error,
    };
    setBulkGenerationWpInventoryEntry(failed);
    return failed;
  }

  const rows = prefetch.bulkInventoryRows ?? [];
  const result: BulkGenerationWpInventory = {
    siteId: site.id,
    rows,
    fetchedAt: prefetch.fetchedAt,
    ...(rows.length === 0 ? { error: "No inventory rows returned." } : {}),
  };
  setBulkGenerationWpInventoryEntry(result);
  return result;
}

/** Re-export for callers seeding from overview parallel fetch. */
export type { OverviewParallelInventoryResult } from "@/lib/overview/overview-parallel-inventory-fetch";
