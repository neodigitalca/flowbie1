import { normalizeGridTopicTag } from "@/lib/sitemap-optimizer/grid-tag-key";
import {
  brandTokensFromSiteUrl,
  textContainsSiteBrandToken,
} from "@/lib/sitemap-optimizer/site-brand-tokens";
import type { SitemapOptimizerPostRow } from "@/lib/sitemap-optimizer/types";

export const COMPANY_TOPIC_TAG = "company";
export const COMPANY_TAG_LABEL = "Company";

const COMPANY_SIGNAL =
  /\b(welcome|welcomes|welcoming|announces|announced|announcement|new partner|joins our team|join our team|joining our team|promoted|promotion|award|awards|milestone|anniversary|careers?|hiring|we hired|team member|community involvement|firm news|proud to announce|congratulations|bunnock|championship|client focus group|valued clients|merry christmas|has moved|powered by|our firm|from our firm|to our valued)\b/i;

const EVERGREEN_SIGNAL =
  /\b(budget|tax rate|tax rates|brackets|deduction|deductions|cra\b|quickbooks|how to|guide for|filing|gst\b|hst\b|cerb\b|ceba\b|covid benefit|income tax act|financial plan|bookkeeping tips|profit strategies for business)\b/i;

const FIRM_PATH_SIGNAL =
  /\b(about-us|our-team|meet-the-team|staff spotlight|employee spotlight|careers|firm-news|company-news|llp-updates)\b/i;

export type CompanyNewsDetectOptions = {
  siteBrandTokens?: readonly string[];
};

function rowHaystack(row: SitemapOptimizerPostRow): string {
  const parts = [row.title, row.gridTagLabel, row.url, row.gridRedirectFromUrl, row.gridTopicTag]
    .filter(Boolean)
    .join(" ");
  return parts.toLowerCase();
}

function slugHaystack(row: SitemapOptimizerPostRow): string {
  const parts = [row.url, row.gridRedirectFromUrl, row.title].filter(Boolean).join(" ");
  return parts.toLowerCase();
}

/** Firm / company news or brand-in-path content (not generic tax guides). */
export function isCompanyNewsRow(
  row: SitemapOptimizerPostRow,
  options?: CompanyNewsDetectOptions,
): boolean {
  const topic = normalizeGridTopicTag(row.gridTopicTag ?? "");
  if (topic === COMPANY_TOPIC_TAG || topic === "company_news" || topic === "firm_news") {
    return true;
  }

  const hay = rowHaystack(row);
  const slug = slugHaystack(row);
  const brandTokens = options?.siteBrandTokens ?? [];

  if (brandTokens.length > 0 && textContainsSiteBrandToken(slug, brandTokens)) {
    if (COMPANY_SIGNAL.test(hay) || FIRM_PATH_SIGNAL.test(slug)) return true;
    if (!EVERGREEN_SIGNAL.test(hay)) return true;
  }

  if (EVERGREEN_SIGNAL.test(hay) && !COMPANY_SIGNAL.test(hay)) {
    return false;
  }
  if (COMPANY_SIGNAL.test(hay)) {
    return true;
  }

  return FIRM_PATH_SIGNAL.test(slug);
}

export function applyCompanyNewsTags(
  rows: readonly SitemapOptimizerPostRow[],
  siteUrl?: string | null,
): SitemapOptimizerPostRow[] {
  const brandTokens = siteUrl?.trim() ? brandTokensFromSiteUrl(siteUrl) : [];
  const detectOpts: CompanyNewsDetectOptions = { siteBrandTokens: brandTokens };

  return rows.map((row) => {
    if (!isCompanyNewsRow(row, detectOpts)) return row;
    return {
      ...row,
      gridTopicTag: COMPANY_TOPIC_TAG,
      gridTagLabel: COMPANY_TAG_LABEL,
      gridIntent: row.gridIntent ?? "mixed",
    };
  });
}

export function siteBrandTokensForUrl(siteUrl?: string | null): string[] {
  return siteUrl?.trim() ? brandTokensFromSiteUrl(siteUrl) : [];
}
