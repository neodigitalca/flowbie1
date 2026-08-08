import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import { extractGeographicEntityWithAI } from "@/lib/content-optimization/entity";
import { resolveEntityWikipediaMediaWiki, entityWikiLookupCandidates } from "@/lib/wikipedia/resolve-entity-wikipedia-mediawiki";
import { findPhraseOutsideTags } from "@/lib/overview/overview-blog-links-extract";
import { lookupOverviewInventoryHitForUrl } from "@/hooks/content-optimization/bulk-seo-extra-text-fast-path";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { effectiveHasEntityForContentOptimizer } from "@/lib/entity-endpoint-extractor";

export type WikipediaLinkInsertResult = {
  html: string;
  ok: boolean;
  anchor: string;
  url: string;
};

function normalizeWikiHrefForCompare(u: string): string {
  const decoded = u.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  return decoded
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export function isWikipediaHref(href: string): boolean {
  return /wikipedia\.org/i.test(href.trim());
}

export type WikipediaLinkWithContext = {
  href: string;
  anchor: string;
  contextBefore: string;
  contextAfter: string;
};

export function wikipediaTitleFromHref(href: string): string {
  try {
    const seg = new URL(href.replace(/&amp;/g, "&")).pathname.split("/").pop() ?? "";
    return decodeURIComponent(seg.replace(/_/g, " ")).trim() || href.trim();
  } catch {
    return href.trim();
  }
}

function htmlToPlainSnippet(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Wikipedia anchors in body HTML with plain-text context for verification UI. */
export function extractWikipediaLinksWithContext(
  html: string,
  contextChars = 72,
): WikipediaLinkWithContext[] {
  if (!html?.trim()) return [];
  const out: WikipediaLinkWithContext[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = match[1]?.trim() ?? "";
    if (!isWikipediaHref(href)) continue;
    const anchor = htmlToPlainSnippet(match[2] ?? "");
    const start = match.index;
    const end = start + match[0].length;
    out.push({
      href,
      anchor: anchor || wikipediaTitleFromHref(href),
      contextBefore: htmlToPlainSnippet(html.slice(Math.max(0, start - contextChars), start)),
      contextAfter: htmlToPlainSnippet(html.slice(end, end + contextChars)),
    });
  }
  return out;
}

export function entityPhraseCandidates(entity: string): string[] {
  const trimmed = entity.trim();
  if (!trimmed) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const key = p.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(p.trim());
  };
  push(trimmed);
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx > 0) {
    push(trimmed.slice(0, commaIdx).trim());
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    push(words.slice(0, 2).join(" "));
  }
  if (words.length >= 1) {
    push(words[0]!);
  }
  return out.sort((a, b) => b.length - a.length);
}

export function htmlAlreadyHasWikiLink(html: string, wikiUrl: string): boolean {
  const targetNorm = normalizeWikiHrefForCompare(wikiUrl);
  const re = /<a\b[^>]*href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const h = m[1];
    if (!/wikipedia\.org/i.test(h)) continue;
    if (normalizeWikiHrefForCompare(h) === targetNorm) return true;
  }
  return false;
}

export function insertWikipediaLinkAtEarliestEntityReference(
  html: string,
  entity: string,
  wikiUrl: string,
): WikipediaLinkInsertResult {
  const url = wikiUrl.trim();
  const entityLabel = entity.trim();
  if (!html?.trim() || !entityLabel || !url) {
    return { html, ok: false, anchor: "", url };
  }
  if (htmlAlreadyHasWikiLink(html, url)) {
    return { html, ok: false, anchor: "", url };
  }

  const safeHref = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  for (const phrase of entityPhraseCandidates(entityLabel)) {
    const hit = findEarliestPhraseOutsideAnchors(html, phrase);
    if (!hit) continue;
    const anchorText = html.slice(hit.start, hit.start + hit.length);
    const linked = `<a href="${safeHref}">${anchorText}</a>`;
    const next =
      html.slice(0, hit.start) + linked + html.slice(hit.start + hit.length);
    return { html: next, ok: true, anchor: anchorText, url };
  }

  return { html, ok: false, anchor: "", url };
}

function insertWikipediaLinkAtFirstParagraph(
  html: string,
  wikiUrl: string,
  anchorLabel: string,
): WikipediaLinkInsertResult {
  const url = wikiUrl.trim();
  const label = anchorLabel.trim() || wikipediaTitleFromHref(url);
  if (!html?.trim() || !url) {
    return { html, ok: false, anchor: "", url };
  }
  const safeHref = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const linked = `<a href="${safeHref}">${label}</a>`;
  const pMatch = html.match(/<p\b[^>]*>/i);
  if (pMatch && pMatch.index != null) {
    const insertAt = pMatch.index + pMatch[0].length;
    return {
      html: `${html.slice(0, insertAt)}${linked} ${html.slice(insertAt)}`,
      ok: true,
      anchor: label,
      url,
    };
  }
  return {
    html: `<p>${linked}</p>\n${html}`,
    ok: true,
    anchor: label,
    url,
  };
}

/** Earliest entity mention, then wiki title, then first paragraph. */
export function insertWikipediaLink(
  html: string,
  entity: string,
  wikiUrl: string,
  wikiTitle?: string,
): WikipediaLinkInsertResult {
  if (htmlAlreadyHasWikiLink(html, wikiUrl)) {
    return { html, ok: false, anchor: "", url: wikiUrl };
  }
  const earliest = insertWikipediaLinkAtEarliestEntityReference(html, entity, wikiUrl);
  if (earliest.ok) return earliest;
  const title = wikiTitle?.trim();
  if (title) {
    const byTitle = insertWikipediaLinkAtEarliestEntityReference(html, title, wikiUrl);
    if (byTitle.ok) return byTitle;
  }
  return insertWikipediaLinkAtFirstParagraph(html, wikiUrl, title || entity);
}

function entityHintsFromOverviewUrl(url: string): string[] {
  try {
    const slug = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
    const phrase = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    if (!phrase) return [];
    return entityWikiLookupCandidates(phrase);
  } catch {
    return [];
  }
}

function isInsideAnchor(html: string, index: number): boolean {
  const before = html.slice(0, index);
  const openA = (before.match(/<a\b/gi) || []).length;
  const closeA = (before.match(/<\/a>/gi) || []).length;
  return openA > closeA;
}

function findEarliestPhraseOutsideAnchors(
  html: string,
  phrase: string,
): { start: number; length: number } | null {
  let searchFrom = 0;
  while (searchFrom < html.length) {
    const slice = html.slice(searchFrom);
    const hit = findPhraseOutsideTags(slice, phrase);
    if (!hit) return null;
    const absStart = searchFrom + hit.start;
    if (!isInsideAnchor(html, absStart)) {
      return { start: absStart, length: hit.length };
    }
    searchFrom = absStart + 1;
  }
  return null;
}

function readOriginFromInventoryAcf(acf: Record<string, unknown> | undefined): string {
  if (!acf || typeof acf !== "object") return "";
  const raw = acf.origin;
  return typeof raw === "string" ? raw.trim() : "";
}

export type ResolveEntityWikiParams = {
  row: OverviewRow;
  site: WordPressSite;
  sitemapSource?: OverviewSitemapSource;
  urlEntities?: Record<string, string>;
  apiKey?: string;
  wikiCache?: Map<string, { url: string; title: string } | null>;
};

export async function resolveEntityAndWikiForOverviewRow(
  params: ResolveEntityWikiParams,
): Promise<{ entity: string; wikiUrl: string; wikiTitle: string; linkEntity: string } | null> {
  const { row, site, sitemapSource, urlEntities, apiKey, wikiCache } = params;
  const url = row.url?.trim();
  if (!url) return null;

  let entity = "";
  const invHit = lookupOverviewInventoryHitForUrl(site, url, sitemapSource);
  const acf =
    invHit?.row?.acf && typeof invHit.row.acf === "object"
      ? (invHit.row.acf as Record<string, unknown>)
      : undefined;
  entity = readOriginFromInventoryAcf(acf);

  if (!entity && urlEntities?.[url]?.trim() && urlEntities[url] !== "N/A") {
    entity = urlEntities[url]!.trim();
  }

  if (!entity) {
    entity = (row.focusKeyword || row.title || "").trim();
  }

  const endpoint = invHit?.source === "pages" ? "pages" : invHit?.source === "posts" ? "posts" : invHit?.source;
  const hasEntity = effectiveHasEntityForContentOptimizer(site, endpoint ?? null, undefined);
  if (!entity && hasEntity !== false && apiKey?.trim()) {
    try {
      const slug = (() => {
        try {
          const p = new URL(url).pathname.split("/").filter(Boolean);
          return p[p.length - 1] ?? "";
        } catch {
          return "";
        }
      })();
      const extracted = await extractGeographicEntityWithAI(
        { title: row.title, url, slug: slug || undefined },
        apiKey.trim(),
        {
          siteUrl: site.siteUrl,
          siteName: site.name,
          locations: site.locations,
          napAddress: site.napInfo?.address,
        },
      );
      if (extracted?.trim()) entity = extracted.trim();
    } catch {
      /* fall through */
    }
  }

  if (!entity || entity === "N/A") {
    entity = entityHintsFromOverviewUrl(url)[0] ?? "";
  }

  const baseEntity = entity.trim();
  const lookupCandidates = [
    ...new Set([
      baseEntity,
      ...entityWikiLookupCandidates(baseEntity),
      ...entityHintsFromOverviewUrl(url),
      (row.focusKeyword || "").trim(),
      (row.title || "").trim(),
    ]),
  ].filter((c) => c && c !== "N/A");

  for (const candidate of lookupCandidates) {
    const cacheKey = candidate.toLowerCase();
    let cached = wikiCache?.get(cacheKey) as
      | { url: string; title: string; matchLabel: string }
      | null
      | undefined;
    if (cached === undefined) {
      const hit = await resolveEntityWikipediaMediaWiki(candidate);
      cached = hit
        ? {
            url: hit.url,
            title: hit.title,
            matchLabel: hit.matchLabel,
          }
        : null;
      wikiCache?.set(cacheKey, cached);
    }
    if (cached?.url) {
      return {
        entity: baseEntity || candidate,
        wikiUrl: cached.url,
        wikiTitle: cached.title,
        linkEntity: cached.matchLabel || candidate,
      };
    }
  }

  return null;
}
