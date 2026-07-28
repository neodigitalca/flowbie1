import {
  anchorLabelFromInventoryRow,
  pickPressReleaseAnchorsFromInventory,
  type PressReleaseInventoryRow,
} from "@/lib/press-release/press-release-anchor-from-inventory";
import { getSiteCache } from "@/lib/wordpress-site-cache";

export type PressReleaseAnchorLink = {
  keyword: string;
  url: string;
};

const ANCHOR_LINK_ROW_COUNT = 3;
const KEYWORD_MAX = 75;

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function ensureHttpsUrl(url: string): string {
  const t = url.trim();
  if (!t || t === "http://" || t === "https://") return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, "")}`;
}

function normalizeSiteHost(siteUrl: string): string {
  try {
    return new URL(ensureHttpsUrl(siteUrl)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

/** True when URL is on the connected WordPress site (not third-party, e.g. clutch.co). */
export function isInternalPressReleaseUrl(url: string, siteUrl: string): boolean {
  const siteHost = normalizeSiteHost(siteUrl);
  if (!siteHost || !url.trim()) return false;
  try {
    const host = new URL(ensureHttpsUrl(url)).hostname.replace(/^www\./i, "").toLowerCase();
    return host === siteHost;
  } catch {
    return false;
  }
}

export type BuildAutoPressReleaseAnchorLinksInput = {
  primaryKeyword: string;
  siteName: string;
  siteUrl: string;
  headline: string;
  releaseMarkdown: string;
  siteId?: string;
  /** Published posts/pages from getSiteInventoryBulk; uses homepage + 2 WP pages only. */
  inventoryRows?: PressReleaseInventoryRow[];
};

/** Programmatic 3-row table: homepage + two money pages (no blog posts). */
export function buildAutoPressReleaseAnchorLinks(
  input: BuildAutoPressReleaseAnchorLinksInput,
): PressReleaseAnchorLink[] {
  const siteRoot = ensureHttpsUrl(input.siteUrl);

  if (input.inventoryRows?.length) {
    const fromInventory = pickPressReleaseAnchorsFromInventory(
      input.inventoryRows,
      input.primaryKeyword,
      siteRoot,
      input.siteName,
    );
    if (fromInventory.length >= ANCHOR_LINK_ROW_COUNT) {
      return fromInventory.slice(0, ANCHOR_LINK_ROW_COUNT);
    }
  }

  const rows: PressReleaseAnchorLink[] = [];
  const seenKeywords = new Set<string>();

  const push = (keyword: string, url: string) => {
    if (rows.length >= ANCHOR_LINK_ROW_COUNT) return;
    const k = keyword.trim().slice(0, KEYWORD_MAX);
    const u = ensureHttpsUrl(url);
    if (!k || !u || !isInternalPressReleaseUrl(u, siteRoot)) return;
    const kwKey = k.toLowerCase();
    if (seenKeywords.has(kwKey)) return;
    const urlKey = u.replace(/\/+$/, "").toLowerCase();
    if (rows.some((r) => r.url.replace(/\/+$/, "").toLowerCase() === urlKey)) return;
    seenKeywords.add(kwKey);
    rows.push({ keyword: k, url: u });
  };

  push(input.siteName.trim() || input.primaryKeyword.trim(), siteRoot);

  if (input.siteId?.trim()) {
    const cache = getSiteCache(input.siteId.trim());
    const pages =
      cache?.posts?.filter((p) => p.postType === "page" && (p.link ?? "").trim()) ?? [];
    for (const page of pages) {
      push((page.title ?? "").trim() || input.primaryKeyword, page.link);
      if (rows.length >= ANCHOR_LINK_ROW_COUNT) break;
    }
  }

  while (rows.length < ANCHOR_LINK_ROW_COUNT) {
    push(input.primaryKeyword.trim() || input.siteName.trim(), siteRoot);
    if (rows.length >= ANCHOR_LINK_ROW_COUNT) break;
    push(input.headline.trim() || input.siteName.trim(), siteRoot);
    break;
  }

  return rows.slice(0, ANCHOR_LINK_ROW_COUNT);
}

/** Fixed closing block: 3-row keyword / URL table (always appended to PR output). */
export function buildPressReleaseAnchorLinksTable(
  links: PressReleaseAnchorLink[],
): string {
  const rows = Array.from({ length: ANCHOR_LINK_ROW_COUNT }, (_, i) => {
    const kw = (links[i]?.keyword ?? "").trim().slice(0, KEYWORD_MAX);
    const url = ensureHttpsUrl(links[i]?.url ?? "");
    return `| ${escapeMarkdownTableCell(kw)} | ${escapeMarkdownTableCell(url)} |`;
  });

  return [
    "## Keyword anchor text links",
    "",
    "| Keyword | URL |",
    "| --- | --- |",
    ...rows,
  ].join("\n");
}

export function appendPressReleaseAnchorLinksSection(
  markdown: string,
  input: BuildAutoPressReleaseAnchorLinksInput,
): string {
  const links = buildAutoPressReleaseAnchorLinks(input);
  const body = markdown.trimEnd();
  const table = buildPressReleaseAnchorLinksTable(links);
  return body ? `${body}\n\n${table}` : table;
}
