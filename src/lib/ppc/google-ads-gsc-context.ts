import type { WordPressSite } from "@/components/integrations/types";
import { fetchGSCPagesPerformanceBatch } from "@/lib/wordpress-api/gsc";
import { getPreviousCalendarMonthUtcRange } from "@/lib/gsc-date-range";
import type { PpcGscPageContext, PpcGscQueryRow, PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

function normalizeQueryRow(raw: {
  query?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}): PpcGscQueryRow | null {
  const query = raw.query?.trim();
  if (!query) return null;
  return {
    query,
    clicks: Number(raw.clicks) || 0,
    impressions: Number(raw.impressions) || 0,
    ctr: Number(raw.ctr) || 0,
    position: Number(raw.position) || 0,
  };
}

export async function loadPpcGoogleGscContext(
  site: WordPressSite,
  landingPages: PpcWpPageContext[],
  signal?: AbortSignal,
): Promise<PpcGscPageContext[]> {
  if (!landingPages.length) return [];

  const { startStr, endStr } = getPreviousCalendarMonthUtcRange();
  const pageUrls = landingPages.map((p) => p.url);

  const batch = await fetchGSCPagesPerformanceBatch(
    site.siteUrl,
    pageUrls,
    startStr,
    endStr,
    signal,
    { strictPageMatch: true },
  );

  const byUrl = new Map<string, PpcGscPageContext>();

  for (const result of batch.pages ?? []) {
    const url = result.pageUrl?.trim();
    if (!url) continue;
    const queries = (result.queries ?? [])
      .map(normalizeQueryRow)
      .filter((q): q is PpcGscQueryRow => q !== null)
      .sort((a, b) => b.impressions - a.impressions);
    byUrl.set(normalizePageUrlKey(url), { url, queries });
  }

  return landingPages.map((page) => {
    const key = normalizePageUrlKey(page.url);
    return byUrl.get(key) ?? { url: page.url, queries: [] };
  });
}

export function rankPpcLandingPagesByGscImpressions(
  pages: PpcWpPageContext[],
  gscPages: PpcGscPageContext[],
  limit: number,
): PpcWpPageContext[] {
  const impressionsByUrl = new Map<string, number>();
  for (const gsc of gscPages) {
    const total = gsc.queries.reduce((sum, q) => sum + q.impressions, 0);
    impressionsByUrl.set(normalizePageUrlKey(gsc.url), total);
  }

  return [...pages]
    .sort((a, b) => {
      const ai = impressionsByUrl.get(normalizePageUrlKey(a.url)) ?? 0;
      const bi = impressionsByUrl.get(normalizePageUrlKey(b.url)) ?? 0;
      return bi - ai;
    })
    .slice(0, limit);
}
