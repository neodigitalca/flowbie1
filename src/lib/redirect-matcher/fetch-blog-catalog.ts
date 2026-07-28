import type { WordPressSite } from "@/components/integrations/types";
import { stripHtmlToPlainText, truncatePlainText } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { ensureBlogDestinationUrl } from "@/lib/sitemap-optimizer/blog-destination-url";
import { normalizeFocusKeywordPhrase } from "@/lib/rank-math-redirect-csv";
import { REDIRECT_MATCHER_BODY_EXCERPT_MAX } from "@/lib/redirect-matcher/constants";
import type { BlogCatalogEntry } from "@/lib/redirect-matcher/types";
import { getSitePostInventory } from "@/lib/wordpress-api/posts";
import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";

function focusKeywordFromInventory(row: SitePostInventoryRow): string {
  const fromFields = normalizeFocusKeywordPhrase(row.fields?.keyword ?? "");
  if (fromFields) return fromFields;

  const acf = row.acf;
  if (acf && typeof acf === "object") {
    const kw = acf.keyword_focus ?? acf.focus_keyword;
    if (typeof kw === "string" && kw.trim()) {
      return normalizeFocusKeywordPhrase(kw) || "";
    }
  }
  return "";
}

function metaFromInventory(row: SitePostInventoryRow): string {
  const meta = row.fields?.meta?.trim();
  if (meta) return meta;
  const excerpt = stripHtmlToPlainText(row.fields?.excerpt ?? "");
  if (excerpt) return truncatePlainText(excerpt, 300);
  return "";
}

function bodyExcerptFromInventory(row: SitePostInventoryRow): string {
  const plain = stripHtmlToPlainText(row.fields?.content ?? row.fields?.excerpt ?? "");
  return truncatePlainText(plain, REDIRECT_MATCHER_BODY_EXCERPT_MAX);
}

function slugFromInventoryUrl(url: string): string {
  try {
    const segments = new URL(url.trim()).pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  } catch {
    return "";
  }
}

export async function fetchBlogCatalog(site: WordPressSite): Promise<BlogCatalogEntry[]> {
  const siteUrl = site.siteUrl.trim();
  const username = site.username.trim();
  const appPassword = site.appPassword.trim();

  const response = await getSitePostInventory(siteUrl, username, appPassword, {
    includeContent: true,
    includeRawAcf: true,
  });

  if (response.error) {
    return [];
  }

  const posts = response.posts ?? [];
  if (!posts.length) {
    return [];
  }

  const byUrl = new Map<string, BlogCatalogEntry>();

  for (const row of posts) {
    const rawUrl = row.url?.trim();
    if (!rawUrl) continue;

    const normalized = ensureBlogDestinationUrl(rawUrl) ?? rawUrl;
    const key = normalized.toLowerCase();
    if (byUrl.has(key)) continue;

    byUrl.set(key, {
      url: normalized,
      title: row.fields?.title?.trim() || "",
      focusKeyword: focusKeywordFromInventory(row),
      meta: metaFromInventory(row),
      bodyExcerpt: bodyExcerptFromInventory(row),
      slug: row.slug?.trim() || slugFromInventoryUrl(normalized),
      postId: row.id,
    });
  }

  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}
