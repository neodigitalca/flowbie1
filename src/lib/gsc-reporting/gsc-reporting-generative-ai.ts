/**
 * Generative AI Search impressions gate + parsers for GSC reporting.
 * Include only when Search Analytics type=generativeAi is available and primary impressions > 0.
 */

import type { GscPagePerfRow, GscSiteTotalsPreviousMonth } from "@/lib/gsc-reporting/gsc-reporting-fetch";

export const GSC_GENERATIVE_AI_PAGES_FILENAME = "Pages-GenerativeAI-MoM.csv";
export const GSC_GENERATIVE_AI_SITE_TOTALS_FILENAME = "Site-totals-GenerativeAI-MoM.csv";

export type GscGenerativeAiAggregate = GscSiteTotalsPreviousMonth;

export type GscGenerativeAiBundle = {
  available: boolean;
  reason?: string;
  searchType?: string;
  aggregatePrimary?: GscGenerativeAiAggregate | null;
  pagesPrimary?: GscPagePerfRow[];
  aggregateCompare?: GscGenerativeAiAggregate | null;
  pagesCompare?: GscPagePerfRow[];
};

/** True when name is a Generative AI reporting CSV (exact filenames only). */
export function isGenerativeAiReportingFile(name: string): boolean {
  return name === GSC_GENERATIVE_AI_PAGES_FILENAME || name === GSC_GENERATIVE_AI_SITE_TOTALS_FILENAME;
}

/** True when Generative AI seed files are present in the report file set. */
export function seedHasGenerativeAiFiles(files: { name: string }[]): boolean {
  return files.some((f) => isGenerativeAiReportingFile(f.name));
}

/**
 * Include gate: API available and primary generative AI impressions > 0.
 * Zero impressions or unavailable → omit section (no web substitute).
 */
export function shouldIncludeGenerativeAiSection(bundle: GscGenerativeAiBundle | null | undefined): boolean {
  if (!bundle || bundle.available !== true) return false;
  const impressions = bundle.aggregatePrimary?.impressions;
  return typeof impressions === "number" && Number.isFinite(impressions) && impressions > 0;
}

export function parseGenerativeAiBundleFromApi(raw: unknown): GscGenerativeAiBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.available === false) {
    return {
      available: false,
      reason: typeof o.reason === "string" ? o.reason : undefined,
    };
  }
  if (o.available !== true) return null;

  const mapAgg = (v: unknown): GscGenerativeAiAggregate | null => {
    if (!v || typeof v !== "object") return null;
    const a = v as Record<string, unknown>;
    const impressions = Number(a.impressions);
    if (!Number.isFinite(impressions)) return null;
    return {
      label: String(a.label ?? ""),
      startDate: String(a.startDate ?? ""),
      endDate: String(a.endDate ?? ""),
      clicks: Number(a.clicks) || 0,
      impressions,
      ctr: Number(a.ctr) || 0,
      position: Number(a.position) || 0,
    };
  };

  const mapPages = (v: unknown): GscPagePerfRow[] => {
    if (!Array.isArray(v)) return [];
    const out: GscPagePerfRow[] = [];
    for (const row of v) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const page = String(r.page ?? "").trim();
      if (!page) continue;
      out.push({
        page,
        clicks: Number(r.clicks) || 0,
        impressions: Number(r.impressions) || 0,
        ctr: Number(r.ctr) || 0,
        position: Number(r.position) || 0,
        date: typeof r.date === "string" ? r.date : undefined,
      });
    }
    return out;
  };

  return {
    available: true,
    searchType: typeof o.searchType === "string" ? o.searchType : undefined,
    aggregatePrimary: mapAgg(o.aggregatePrimary),
    pagesPrimary: mapPages(o.pagesPrimary),
    aggregateCompare: mapAgg(o.aggregateCompare),
    pagesCompare: mapPages(o.pagesCompare),
  };
}
