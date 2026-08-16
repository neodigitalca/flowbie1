import type { WordPressSite } from "@/components/integrations/types";
import { fetchOverviewInventoryForSource } from "@/lib/overview/overview-parallel-inventory-fetch";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { isContentCreatorExcludedLandingPage } from "@/lib/social/content-creator-landing-pages";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type GbpLandingPageAssignMode = "initial" | "shuffle";

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = normalizePageUrlKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}

export function isGbpHomepageUrl(url: string, siteUrl: string): boolean {
  const urlKey = normalizePageUrlKey(url);
  const siteKey = normalizePageUrlKey(siteUrl);
  if (!urlKey || !siteKey) return false;
  return urlKey === siteKey;
}

function filterEligibleGbpLandingUrls(
  rows: Awaited<ReturnType<typeof fetchOverviewInventoryForSource>>["rows"],
): string[] {
  return dedupeUrls(
    rows
      .filter((row) => {
        const url = typeof row.url === "string" ? row.url : "";
        return (
          url.length > 0 &&
          !isContentCreatorExcludedLandingPage({
            url,
            slug: typeof row.slug === "string" ? row.slug : undefined,
            title: typeof row.fields?.title === "string" ? row.fields.title : undefined,
          })
        );
      })
      .map((row) => String(row.url)),
  );
}

export async function loadGbpLandingPageCandidates(
  site: WordPressSite,
  source: OverviewSitemapSource,
): Promise<string[]> {
  const username = site.username?.trim() ?? "";
  const appPassword = site.appPassword?.trim() ?? "";
  if (!username || !appPassword) return [];

  const result = await fetchOverviewInventoryForSource(site, source, { includeScheduled: true });
  return filterEligibleGbpLandingUrls(result.rows);
}

export function pickInitialGbpLandingPage(candidates: string[], siteUrl: string): string {
  if (!candidates.length) return "";
  const siteRoot = siteUrl.trim();
  const nonHome = candidates.find((url) => !isGbpHomepageUrl(url, siteRoot));
  return nonHome ?? candidates[0] ?? "";
}

export function pickRandomGbpLandingPage(candidates: string[], currentUrl?: string): string {
  if (!candidates.length) return "";
  if (candidates.length === 1) return candidates[0] ?? "";

  const currentKey = normalizePageUrlKey(currentUrl ?? "");
  const alternates =
    currentKey.length > 0
      ? candidates.filter((url) => normalizePageUrlKey(url) !== currentKey)
      : candidates;
  const pool = alternates.length > 0 ? alternates : candidates;
  return pool[Math.floor(Math.random() * pool.length)] ?? "";
}

export function buildGbpLandingPageAssignments(
  sites: WordPressSite[],
  candidatesBySiteId: Record<string, string[]>,
  mode: GbpLandingPageAssignMode,
  currentBySiteId: Record<string, string> = {},
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const site of sites) {
    const candidates = candidatesBySiteId[site.id] ?? [];
    if (!candidates.length) {
      next[site.id] = "";
      continue;
    }
    next[site.id] =
      mode === "shuffle"
        ? pickRandomGbpLandingPage(candidates, currentBySiteId[site.id])
        : pickInitialGbpLandingPage(candidates, site.siteUrl ?? "");
  }
  return next;
}

export async function loadGbpLandingPageCandidatesForSites(
  sites: WordPressSite[],
  source: OverviewSitemapSource,
): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    sites.map(async (site) => {
      try {
        const candidates = await loadGbpLandingPageCandidates(site, source);
        return [site.id, candidates] as const;
      } catch {
        return [site.id, []] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
