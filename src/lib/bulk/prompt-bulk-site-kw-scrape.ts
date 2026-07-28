import type { WordPressSite } from "@/components/IntegrationsTab";
import {
  isBlockedContentTopicPhrase,
} from "@/lib/content-topic-blocklist";
import {
  isConnectedSiteBrandAsKeyword,
} from "@/lib/bulk/bulk-gsc-site-queries";
import { fetchCompetitorGscQueries } from "@/lib/competitor-research/competitor-gsc-queries";
import { fetchManualCompetitorDomain } from "@/lib/competitor-research/competitor-semrush-client";
import {
  revokePressReleaseInventoryHostedLink,
  type PressReleaseInventoryHostedLink,
} from "@/lib/press-release/press-release-site-inventory";

export type PromptBulkSiteKwJson = {
  siteUrl: string;
  generatedAt: string;
  sortMethod: string;
  /** Priority source: metric-sorted Semrush phrases, metrics stripped. */
  semrush: string[];
  /** Secondary source: metric-sorted GSC queries, metrics stripped. */
  gsc: string[];
};

export type PromptBulkSiteKwHostedLink = PressReleaseInventoryHostedLink & {
  label: string;
};

export type PromptBulkSiteKwScrapeResult = {
  json: PromptBulkSiteKwJson;
  keywordsJsonText: string;
  hostedLink: PromptBulkSiteKwHostedLink;
};

function hostSlugForInventoryFile(siteUrl: string): string {
  try {
    const raw = siteUrl.trim();
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname.replace(/[^a-zA-Z0-9.-]+/g, "-").slice(0, 80) || "site";
  } catch {
    return "site";
  }
}

function domainFromSiteUrl(siteUrl: string): string {
  try {
    const raw = siteUrl.trim();
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function gscOpportunityScore(row: {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}): number {
  const impressions = Math.max(0, row.impressions);
  const position = row.position > 0 ? row.position : 100;
  const lowHangingBoost = position >= 4 && position <= 20 ? 2 : 1;
  const ctrGap = Math.max(0.1, 1 - Math.max(0, row.ctr));
  return (impressions * ctrGap * lowHangingBoost) / position;
}

function semrushOpportunityScore(row: {
  volume: number | null | undefined;
  traffic: number | null | undefined;
  position: number | null | undefined;
}): number {
  const volume = Math.max(0, row.volume ?? 0);
  const traffic = Math.max(0, row.traffic ?? 0);
  const position = row.position && row.position > 0 ? row.position : 100;
  const rankingBoost = position >= 4 && position <= 30 ? 2 : 1;
  return ((traffic * 2) + volume) * rankingBoost / position;
}

function uniqueKeywords(
  values: string[],
  limit: number,
  companyName?: string | null,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const keyword = raw.trim().replace(/\s+/g, " ");
    if (!keyword) continue;
    if (isBlockedContentTopicPhrase(keyword)) continue;
    if (isConnectedSiteBrandAsKeyword(keyword, companyName)) continue;
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keyword);
    if (out.length >= limit) break;
  }
  return out;
}

export function createPromptBulkSiteKwHostedLink(
  siteUrl: string,
  keywordsJsonText: string,
  rowCount: number,
): PromptBulkSiteKwHostedLink {
  const slug = hostSlugForInventoryFile(siteUrl);
  const filename = `site-kw-${slug}-${Date.now()}.json`;
  const blob = new Blob([keywordsJsonText], { type: "application/json;charset=utf-8" });
  return {
    label: "KW JSON",
    href: URL.createObjectURL(blob),
    filename,
    rowCount,
  };
}

export function revokePromptBulkSiteKwHostedLink(
  link: PromptBulkSiteKwHostedLink | null | undefined,
): void {
  revokePressReleaseInventoryHostedLink(link?.href);
}

export async function scrapePromptBulkSiteKwJson(
  site: WordPressSite,
): Promise<PromptBulkSiteKwScrapeResult> {
  const siteUrl = site.siteUrl?.trim() || "";

  const [gscRows, semrushRows] = await Promise.all([
    (async () => {
      try {
        const res = await fetchCompetitorGscQueries({
          siteUrl,
          rowLimit: 500,
        });
        if (!res.ok) return [];
        return res.queries
          .filter((row) => row.query?.trim())
          .map((row) => ({
            query: row.query.trim(),
            clicks: num(row.clicks),
            impressions: num(row.impressions),
            ctr: num(row.ctr),
            position: num(row.position),
          }))
          .sort((a, b) => gscOpportunityScore(b) - gscOpportunityScore(a))
          .slice(0, 500)
          .map((row) => row.query);
      } catch {
        return [];
      }
    })(),
    (async () => {
      try {
        const domain = domainFromSiteUrl(siteUrl);
        if (!domain) return [];
        const res = await fetchManualCompetitorDomain({
          domain,
          siteUrl,
        });
        return (res.enrichment.topKeywords ?? [])
          .filter((row) => row.phrase?.trim())
          .sort((a, b) => semrushOpportunityScore(b) - semrushOpportunityScore(a))
          .slice(0, 100)
          .map((row) => row.phrase.trim());
      } catch {
        return [];
      }
    })(),
  ]);

  const companyName = site.name?.trim() || "";
  const json: PromptBulkSiteKwJson = {
    siteUrl,
    generatedAt: new Date().toISOString(),
    sortMethod:
      "Metrics were used locally, then removed. Semrush is listed first and sorted by volume/traffic with ranking position boost. GSC is second, sorted by low-hanging opportunity using impressions, CTR gap, and position 4-20 boost.",
    semrush: uniqueKeywords(semrushRows, 100, companyName),
    gsc: uniqueKeywords(gscRows, 500, companyName),
  };
  const keywordsJsonText = JSON.stringify(json, null, 2);
  const hostedLink = createPromptBulkSiteKwHostedLink(
    siteUrl,
    keywordsJsonText,
    json.gsc.length + json.semrush.length,
  );

  return {
    json,
    keywordsJsonText,
    hostedLink,
  };
}
