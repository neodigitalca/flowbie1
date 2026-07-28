/**
 * Pick up to 10 same-origin URLs for proposal site audit (GSC top pages or sitemap fallback).
 */

import type { WordPressSite } from "@/components/integrations/types";
import { getDefaultGscCompetitorDateRange } from "@/lib/competitor-research/competitor-gsc-queries";
import type { GscCompetitorDateRange } from "@/lib/competitor-research/types";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { parseSitemap } from "@/lib/wordpress-api/connection";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";

export const PROPOSAL_AUDIT_PAGE_LIMIT = 10 as const;

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    u.hash = "";
    return u.href.replace(/\/$/, "") || u.origin;
  } catch {
    return null;
  }
}

function sameOrigin(url: string, seedOrigin: string): boolean {
  try {
    return new URL(url).origin === new URL(seedOrigin).origin;
  } catch {
    return false;
  }
}

function homepageUrl(seedUrl: string): string {
  try {
    const u = new URL(seedUrl.startsWith("http") ? seedUrl : `https://${seedUrl}`);
    return u.origin;
  } catch {
    return seedUrl;
  }
}

function dedupeUrls(urls: string[], seedUrl: string, limit: number): string[] {
  const origin = homepageUrl(seedUrl);
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const n = normalizeUrl(raw);
    if (!n || !sameOrigin(n, origin)) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };

  push(homepageUrl(seedUrl));
  for (const u of urls) {
    if (out.length >= limit) break;
    push(u);
  }

  return out.slice(0, limit);
}

async function fetchGscTopPageUrls(
  siteUrl: string,
  dateRange: GscCompetitorDateRange,
  limit: number,
): Promise<string[]> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const res = await fetch(`${base}/api/gsc/top-pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      siteUrl,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      limit,
    }),
  });
  const j = (await res.json()) as {
    success?: boolean;
    pages?: Array<{ url?: string }>;
    error?: string;
  };
  if (!res.ok || j.success === false) return [];
  return (j.pages ?? [])
    .map((p) => (typeof p.url === "string" ? p.url.trim() : ""))
    .filter(Boolean);
}

async function fetchSitemapUrls(site: WordPressSite, seedUrl: string, take: number): Promise<string[]> {
  const sitemapUrl = site.sitemaps?.mainSitemapUrl?.trim();
  if (!sitemapUrl) return [];

  try {
    const parsed = await parseSitemap(
      site.siteUrl,
      sitemapUrl,
      site.username || "",
      site.appPassword || "",
    );
    return (parsed.urls ?? []).slice(0, take);
  } catch {
    return [];
  }
}

export type PickProposalAuditPagesArgs = {
  seedUrl: string;
  site?: WordPressSite | null;
  gscDateRange?: GscCompetitorDateRange | null;
};

/**
 * Returns up to 10 absolute URLs on the seed origin for Lighthouse + FAQ audit.
 */
export async function pickProposalAuditPages(
  args: PickProposalAuditPagesArgs,
): Promise<string[]> {
  const seed = normalizeUrl(args.seedUrl);
  if (!seed) return [];

  const limit = PROPOSAL_AUDIT_PAGE_LIMIT;
  const dateRange = args.gscDateRange ?? getDefaultGscCompetitorDateRange();
  const gscSiteUrl = args.site ? getPublicSiteUrl(args.site) : seed;

  let candidates: string[] = [];

  if (args.site?.siteUrl?.trim()) {
    const fromGsc = await fetchGscTopPageUrls(gscSiteUrl, dateRange, limit);
    if (fromGsc.length) candidates = fromGsc;
    else {
      const fromMap = await fetchSitemapUrls(args.site, seed, limit - 1);
      candidates = fromMap;
    }
  } else {
    candidates = [seed];
  }

  return dedupeUrls(candidates, seed, limit);
}
