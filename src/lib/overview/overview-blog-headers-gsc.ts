import { getDefaultGscCompetitorDateRange } from "@/lib/competitor-research/competitor-gsc-queries";
import { fetchGSCPagePerformance } from "@/lib/wordpress-api/gsc";
import type { GSCPageQuery } from "@/lib/wordpress-api/types";

export type BlogHeadersGscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type BlogHeadersGscPicks = {
  dateRange: { startDate: string; endDate: string };
  totalQueries: number;
  byClicks: BlogHeadersGscQueryRow[];
  byCtr: BlogHeadersGscQueryRow[];
  byImpressions: BlogHeadersGscQueryRow[];
  /** Deduped keywords to prioritize in H2 planning (clicks, then impressions, then CTR). */
  headingKeywords: string[];
};

const TOP_N = 10;
const MIN_IMPRESSIONS_FOR_CTR = 5;

function normalizeRow(q: GSCPageQuery): BlogHeadersGscQueryRow {
  return {
    query: String(q.query ?? "").trim(),
    clicks: q.clicks ?? 0,
    impressions: q.impressions ?? 0,
    ctr: q.ctr ?? 0,
    position: q.position ?? 0,
  };
}

function dedupeHeadingKeywords(lists: BlogHeadersGscQueryRow[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const row of list) {
      const q = row.query.trim();
      if (!q) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
  }
  return out;
}

export function rankBlogHeadersGscQueries(queries: GSCPageQuery[]): BlogHeadersGscPicks {
  const rows = queries.map(normalizeRow).filter((r) => r.query.length > 0);
  const dateRange = getDefaultGscCompetitorDateRange();

  const byClicks = [...rows]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, TOP_N);
  const byImpressions = [...rows]
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, TOP_N);
  const byCtr = [...rows]
    .filter((r) => r.impressions >= MIN_IMPRESSIONS_FOR_CTR)
    .sort((a, b) => b.ctr - a.ctr || b.clicks - a.clicks)
    .slice(0, TOP_N);

  return {
    dateRange,
    totalQueries: rows.length,
    byClicks,
    byCtr,
    byImpressions,
    headingKeywords: dedupeHeadingKeywords([byClicks, byImpressions, byCtr]),
  };
}

export async function fetchBlogHeadersGscPicks(
  siteUrl: string,
  pageUrl: string,
  _signal?: AbortSignal,
): Promise<BlogHeadersGscPicks> {
  const range = getDefaultGscCompetitorDateRange();
  const res = await fetchGSCPagePerformance(siteUrl, pageUrl, range.startDate, range.endDate);
  if (!res.success) {
    return rankBlogHeadersGscQueries([]);
  }
  return rankBlogHeadersGscQueries(res.queries ?? []);
}

function formatQueryLine(row: BlogHeadersGscQueryRow, rank: number): string {
  const ctrPct = (row.ctr * 100).toFixed(2);
  return `  ${rank}. "${row.query}" | clicks ${row.clicks} | impr ${row.impressions} | CTR ${ctrPct}% | pos ${row.position.toFixed(1)}`;
}

export function formatBlogHeadersGscHarnessMarkdown(picks: BlogHeadersGscPicks): string {
  const { dateRange, totalQueries, byClicks, byCtr, byImpressions, headingKeywords } = picks;
  const lines: string[] = [
    `GSC page queries (last 3 months: ${dateRange.startDate} to ${dateRange.endDate})`,
    `Total queries for URL: ${totalQueries}`,
    "",
  ];

  if (!totalQueries) {
    lines.push("No Search Console queries for this URL in the date range.");
    lines.push("Planner will use focus keyword and SEO brief only.");
    return lines.join("\n");
  }

  lines.push("TOP BY CLICKS (primary signal for H2 intent):");
  if (!byClicks.length) lines.push("  (none)");
  else byClicks.forEach((r, i) => lines.push(formatQueryLine(r, i + 1)));

  lines.push("");
  lines.push("TOP BY IMPRESSIONS:");
  if (!byImpressions.length) lines.push("  (none)");
  else byImpressions.forEach((r, i) => lines.push(formatQueryLine(r, i + 1)));

  lines.push("");
  lines.push("TOP BY CTR (min 5 impressions):");
  if (!byCtr.length) lines.push("  (none)");
  else byCtr.forEach((r, i) => lines.push(formatQueryLine(r, i + 1)));

  lines.push("");
  lines.push("HEADING KEYWORD PRIORITY (use in H2 text when relevant):");
  if (!headingKeywords.length) lines.push("  (none)");
  else headingKeywords.forEach((kw, i) => lines.push(`  ${i + 1}. ${kw}`));

  return lines.join("\n");
}
