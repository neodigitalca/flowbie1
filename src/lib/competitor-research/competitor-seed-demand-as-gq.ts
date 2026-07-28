import { COMPETITOR_GSC_QUERY_ROW_LIMIT } from "@/lib/competitor-research/competitor-gsc-queries";
import { sortKeywordsByTrafficThenVolume } from "@/lib/competitor-research/competitor-keyword-sort";
import type { CompetitorKeywordRow, GscSiteQueryRow } from "@/lib/competitor-research/types";

/** Align with report agent `REPORT_GSC_QUERIES_MAX` - enough rows for overlap hints without huge payloads. */
export const SEED_DEMAND_AS_GQ_DEFAULT_LIMIT = 200;

/**
 * Build `GscSiteQueryRow`-shaped rows from seed ranked keywords (DataForSEO Labs / Semrush) so downstream
 * code (GSC relevance filter, tier agent, report wire `gq`) works without Search Console.
 * Numeric fields are deterministic proxies only (volume→impressions, traffic→clicks, etc.).
 */
export function buildDemandQueriesFromSeedKeywords(
  keywords: CompetitorKeywordRow[],
  opts?: { limit?: number },
): GscSiteQueryRow[] {
  const cap = Math.min(
    opts?.limit ?? SEED_DEMAND_AS_GQ_DEFAULT_LIMIT,
    COMPETITOR_GSC_QUERY_ROW_LIMIT,
  );
  const sorted = sortKeywordsByTrafficThenVolume([...keywords]);
  const slice = sorted.slice(0, cap);
  return slice.map((k) => {
    const phrase = (k.phrase ?? "").trim() || "(empty)";
    const impressions = Math.max(0, Math.round(k.volume ?? 0));
    const clicks = Math.max(0, Math.round(k.traffic ?? 0));
    const impForCtr = impressions > 0 ? impressions : clicks > 0 ? clicks : 1;
    const ctr = impForCtr > 0 ? Math.min(1, clicks / impForCtr) : 0;
    const position =
      k.position != null && Number.isFinite(k.position) ? k.position : 100;
    return {
      query: phrase,
      impressions: impressions > 0 ? impressions : clicks > 0 ? clicks : 1,
      clicks,
      ctr,
      position,
    };
  });
}
