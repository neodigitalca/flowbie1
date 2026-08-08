import type { KeywordData } from "@/lib/keyword-types";
import type { SeoContentBriefV1 } from "@/lib/overview-seo-content-brief";
import { hasSubstantiveSeoResearch } from "@/hooks/content-optimization/bulk-optimization-missing-seo-research";
import { sortGscQueriesByStats } from "@/lib/bulk/bulk-gsc-site-queries";
import type { GscSiteQueryRow } from "@/lib/competitor-research/types";

export type PageGscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
};

export type PageGscResultLike = {
  success?: boolean;
  queries?: PageGscQueryRow[];
  topKeyword?: PageGscQueryRow | null;
};

export function hasUsablePageGsc(gscResult: PageGscResultLike | null | undefined): boolean {
  const queries = gscResult?.queries;
  if (!Array.isArray(queries) || queries.length === 0) return false;
  return queries.some(
    (q) =>
      q?.query?.trim() &&
      ((q.clicks ?? 0) > 0 || (q.impressions ?? 0) > 0),
  );
}

export function hasSubstantiveSeoResearchBrief(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  return hasSubstantiveSeoResearch({ seo_research: raw });
}

export function parseSeoResearchBrief(raw: string | null | undefined): SeoContentBriefV1 | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as SeoContentBriefV1;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function pageGscKeywordStrings(gscResult: PageGscResultLike | null | undefined, limit = 30): string[] {
  const queries = gscResult?.queries ?? [];
  if (!queries.length) return [];
  const sorted = sortGscQueriesByStats(queries as GscSiteQueryRow[]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of sorted) {
    const kw = row.query?.trim();
    if (!kw || seen.has(kw.toLowerCase())) continue;
    seen.add(kw.toLowerCase());
    out.push(kw);
    if (out.length >= limit) break;
  }
  return out;
}

export function relatedKeywordsFromSeoBrief(brief: SeoContentBriefV1 | null): string[] {
  if (!brief) return [];
  const fromGsc = brief.gsc?.queries ?? [];
  const fromPaa = (brief.dataforseo?.peopleAlsoAsk ?? [])
    .map((p) => p.question?.trim())
    .filter(Boolean) as string[];
  const related = [
    ...(brief.dataforseo?.relatedSearches ?? []),
    ...(brief.dataforseo?.peopleAlsoSearchPhrases ?? []),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of [...fromGsc, ...fromPaa, ...related]) {
    const k = kw.trim();
    if (!k || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    out.push(k);
  }
  return out;
}

export function paaItemsFromSeoBrief(brief: SeoContentBriefV1 | null): Array<{ question: string; snippet: string }> {
  if (!brief?.dataforseo?.peopleAlsoAsk?.length) return [];
  return brief.dataforseo.peopleAlsoAsk
    .map((entry) => ({
      question: entry.question?.trim() ?? "",
      snippet: entry.answers?.[0]?.description?.trim() ?? entry.answers?.[0]?.title?.trim() ?? "",
    }))
    .filter((p) => p.question);
}

export function keywordDataFromSeoBrief(
  brief: SeoContentBriefV1 | null,
  primaryKeyword: string,
  selectedKeyword?: PageGscQueryRow,
  extraRelated: string[] = [],
): KeywordData {
  const keyword = primaryKeyword.trim() || brief?.focusKeyword?.trim() || "";
  const related = [
    ...relatedKeywordsFromSeoBrief(brief),
    ...extraRelated,
  ].filter((k, i, arr) => arr.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i);

  return {
    keyword,
    searchVolume: selectedKeyword?.impressions ?? 0,
    difficulty: 0,
    cpc: 0,
    competition: "LOW",
    intent: "informational",
    relatedKeywords: related,
    serpFeatures: [],
  };
}

export function mergeOptimizeResearchInputs(args: {
  primaryKeyword: string;
  selectedKeyword: PageGscQueryRow;
  gscResult: PageGscResultLike | null | undefined;
  seoResearchBrief: string | null | undefined;
}): {
  keywordData: KeywordData;
  relatedGSCKeywords: string[];
  paaItems: Array<{ question: string; snippet: string }>;
  useCachedResearchOnly: boolean;
} {
  const brief = parseSeoResearchBrief(args.seoResearchBrief);
  const pageGscKws = pageGscKeywordStrings(args.gscResult);
  const briefRelated = relatedKeywordsFromSeoBrief(brief);
  const relatedGSCKeywords = [
    ...pageGscKws,
    ...briefRelated,
  ].filter((k, i, arr) => arr.findIndex((x) => x.toLowerCase() === k.toLowerCase()) === i);

  const keywordData = keywordDataFromSeoBrief(
    brief,
    args.primaryKeyword,
    args.selectedKeyword,
    pageGscKws,
  );

  return {
    keywordData,
    relatedGSCKeywords,
    paaItems: paaItemsFromSeoBrief(brief),
    useCachedResearchOnly: Boolean(brief) || hasUsablePageGsc(args.gscResult),
  };
}
