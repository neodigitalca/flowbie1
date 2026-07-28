import type { SitePostInventoryRow } from "@/lib/wordpress-api/types";
import type { PressReleaseAnchorLink } from "./press-release-anchor-links-table";
import { isInternalPressReleaseUrl } from "./press-release-anchor-links-table";

const KEYWORD_MAX = 75;
const MONEY_PAGE_COUNT = 2;

export type PressReleaseInventoryRow = SitePostInventoryRow & {
  collection?: "posts" | "pages";
};

function ensureHttpsUrl(url: string): string {
  const t = url.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(ensureHttpsUrl(url));
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.hostname.replace(/^www\./i, "").toLowerCase()}${path}`;
  } catch {
    return url.toLowerCase();
  }
}

export function isHomepageUrl(url: string, siteRoot: string): boolean {
  try {
    const u = new URL(ensureHttpsUrl(url));
    const home = new URL(ensureHttpsUrl(siteRoot));
    if (u.hostname.replace(/^www\./i, "") !== home.hostname.replace(/^www\./i, "")) {
      return false;
    }
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

/** Blog / news URLs are not money pages for PR anchor tables. */
export function isLikelyBlogInventoryUrl(url: string): boolean {
  try {
    const path = new URL(ensureHttpsUrl(url)).pathname.toLowerCase();
    if (
      path.includes("/blog/") ||
      path.includes("/blogs/") ||
      path.includes("/news/") ||
      path.includes("/articles/") ||
      path.includes("/category/") ||
      path.includes("/tag/") ||
      path.includes("/author/")
    ) {
      return true;
    }
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const y = Number(segments[0]);
      const m = Number(segments[1]);
      if (!Number.isNaN(y) && !Number.isNaN(m) && y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** WP pages, or non-blog URLs when collection is unknown. */
export function isMoneyPageInventoryRow(row: PressReleaseInventoryRow): boolean {
  if (row.collection === "posts") return false;
  if (row.collection === "pages") return true;
  return !isLikelyBlogInventoryUrl(row.url ?? "");
}

function scoreInventoryRow(row: PressReleaseInventoryRow, primaryKeyword: string): number {
  const q = primaryKeyword.trim().toLowerCase();
  if (!q) return 0;
  const title = (row.fields?.title ?? "").toLowerCase();
  const kw = (row.fields?.keyword ?? "").toLowerCase();
  const url = (row.url ?? "").toLowerCase();
  let score = 0;
  if (kw === q) score += 30;
  if (title === q) score += 25;
  if (kw.includes(q)) score += 18;
  if (title.includes(q)) score += 15;
  if (url.includes(q.replace(/\s+/g, "-"))) score += 8;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    if (kw.includes(w)) score += 4;
    if (title.includes(w)) score += 3;
    if (url.includes(w)) score += 2;
  }
  return score;
}

export function anchorLabelFromInventoryRow(
  row: PressReleaseInventoryRow,
  primaryKeyword: string,
): string {
  const fromKeyword = (row.fields?.keyword ?? "").trim();
  const fromTitle = (row.fields?.title ?? "").trim();
  const pk = primaryKeyword.trim();
  if (fromKeyword) return fromKeyword.slice(0, KEYWORD_MAX);
  if (fromTitle) return fromTitle.slice(0, KEYWORD_MAX);
  return pk.slice(0, KEYWORD_MAX) || fromTitle.slice(0, KEYWORD_MAX);
}

/**
 * Exactly three anchors: homepage + two money pages (WP pages, not blog posts).
 */
export function pickPressReleaseAnchorsFromInventory(
  inventory: PressReleaseInventoryRow[],
  primaryKeyword: string,
  siteUrl: string,
  siteName: string,
): PressReleaseAnchorLink[] {
  const siteRoot = ensureHttpsUrl(siteUrl);
  const seenUrl = new Set<string>();
  const seenKeyword = new Set<string>();
  const out: PressReleaseAnchorLink[] = [];

  const push = (keyword: string, url: string) => {
    const k = keyword.trim().slice(0, KEYWORD_MAX);
    const u = ensureHttpsUrl(url);
    if (!k || !u || !isInternalPressReleaseUrl(u, siteRoot)) return;
    const urlKey = normalizeUrlKey(u);
    const kwKey = k.toLowerCase();
    if (seenUrl.has(urlKey) || seenKeyword.has(kwKey)) return;
    seenUrl.add(urlKey);
    seenKeyword.add(kwKey);
    out.push({ keyword: k, url: u });
  };

  const homeRow = inventory.find((r) => isHomepageUrl(r.url ?? "", siteRoot));
  const homeUrl = homeRow?.url?.trim() ? homeRow.url : siteRoot;
  const homeLabel = siteName.trim() || anchorLabelFromInventoryRow(homeRow ?? { url: homeUrl, fields: { title: "", meta: "", keyword: "" } }, primaryKeyword);
  push(homeLabel, homeUrl);

  const moneyRanked = inventory
    .filter((r) => (r.url ?? "").trim() && isMoneyPageInventoryRow(r) && !isHomepageUrl(r.url, siteRoot))
    .map((row) => ({ row, score: scoreInventoryRow(row, primaryKeyword) }))
    .sort((a, b) => b.score - a.score);

  for (const { row } of moneyRanked) {
    if (out.length >= 1 + MONEY_PAGE_COUNT) break;
    push(anchorLabelFromInventoryRow(row, primaryKeyword), row.url);
  }

  return out;
}
