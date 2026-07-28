import type { CompetitorResearchSemrushResponse } from "@/lib/competitor-research/types";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { stripGeoTokensForContentBlogPhrase } from "@/lib/content-blog-geo-strip";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_GENERATE_THE_COMPETITOR_REPORT_FIRST_BUL, NOTIFY_NO_USABLE_ROWS_IN_THE_REPORT_OR_ONLY_BRA } from "@/lib/notify-messages";
import { downloadLocalAnalysisBulkCsv } from "@/lib/local-analysis-csv-export";
import type { ContentOpportunityMatrixRow } from "@/lib/competitor-research/competitor-report-keyword-extract";
import {
  extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown,
  extractContentOpportunityMatrixRows,
  extractKeywordPhrasesFromCompetitorReportMarkdown,
  filterNonBrandedAttackKeywords,
} from "@/lib/competitor-research/competitor-report-keyword-extract";

/** 3 months × 3 posts/month = 9 rows. Same schedule as the report Content Opportunity Matrix (M1/M2/M3 × 3). */
export const COMPETITOR_BULK_CSV_MONTHS = 3;
export const COMPETITOR_BULK_CSV_BLOGS_PER_MONTH = 3;
export const COMPETITOR_BULK_CSV_TOTAL_POSTS = COMPETITOR_BULK_CSV_MONTHS * COMPETITOR_BULK_CSV_BLOGS_PER_MONTH;

type KeywordPick = { phrase: string; sourceDomain: string };

/** Editorial briefs - informational content blogs (not service-area pages). Reviews/social proof, not case studies. */
const COMPETITOR_CSV_MODIFIER_HINTS: string[] = [
  "Emphasize trustworthy tips and encourage gathering customer reviews (no case studies).",
  "Highlight social proof: ratings, testimonials, and third-party reviews.",
  "Emphasize budget-friendly options and practical steps.",
  "Compare features and pricing of top options.",
  "Include FAQs, scannable headings, and internal links.",
  "Target commercial intent with clear CTAs.",
  "Highlight differentiation vs generic alternatives.",
  "Add expert tips and common mistakes to avoid.",
  "End with a concise next-step checklist.",
];

/** First comma- or semicolon-separated phrase in a matrix Anchor Demand cell. */
function firstSegmentFromAnchorCell(raw: string): string {
  return raw.split(/[,;]/)[0]?.trim() ?? "";
}

/**
 * Normalized keyword string for bulk CSV (geo strip + lower case), used for **Anchor Demand** or title fallback.
 */
function keywordFromAnchorPhrase(phrase: string): string {
  const raw = phrase.trim();
  if (!raw) return raw;
  const withoutGeo = stripGeoTokensForContentBlogPhrase(raw);
  const use = withoutGeo.length > 0 ? withoutGeo : raw;
  return use.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeMatrixFeaturedImage(raw: string | undefined): CSVRow["featuredImage"] {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "y" || t === "n" || t === "google-maps") return t;
  return "y";
}

function rowPassesBrandFilter(
  row: ContentOpportunityMatrixRow,
  siteName: string,
  seedDomain: string | undefined,
  competitorDomains: string[],
): boolean {
  const firstAnchorSegment = row.anchorDemand.split(/[,;]/)[0]?.trim() ?? "";
  const candidates = [row.whatToProduce.trim(), firstAnchorSegment].filter(Boolean);
  for (const c of candidates) {
    if (filterNonBrandedAttackKeywords([c], siteName, seedDomain, competitorDomains).length > 0) return true;
  }
  return false;
}

function buildRowsFromMatrixRows(
  matrixRows: ContentOpportunityMatrixRow[],
  brand: string,
  siteName: string,
  seedDomain: string | undefined,
  competitorDomains: string[],
  maxRows: number,
): CSVRow[] {
  const filtered = matrixRows.filter((r) => rowPassesBrandFilter(r, siteName, seedDomain, competitorDomains));
  const slice = filtered.slice(0, maxRows);
  return slice.map((r, i) => {
    const title = r.whatToProduce.trim();
    const anchorFirst = firstSegmentFromAnchorCell(r.anchorDemand);
    const keyword = keywordFromAnchorPhrase(anchorFirst.length > 0 ? anchorFirst : title);
    const modifier =
      r.modifier?.trim() || COMPETITOR_CSV_MODIFIER_HINTS[i % COMPETITOR_CSV_MODIFIER_HINTS.length];
    const entity = r.entity?.trim() || brand;
    const featuredImage = normalizeMatrixFeaturedImage(r.featuredImage);
    return {
      keyword,
      entity,
      title,
      modifier,
      featuredImage,
    };
  });
}

/**
 * Proposal: fill `maxRows` by **cycling** usable matrix rows (picker count may exceed M1–M3 rows). Matrix-only - no Semrush pool.
 */
function buildRowsFromMatrixRowsCycled(
  matrixRows: ContentOpportunityMatrixRow[],
  brand: string,
  siteName: string,
  seedDomain: string | undefined,
  competitorDomains: string[],
  maxRows: number,
): CSVRow[] {
  const filtered = matrixRows.filter((r) => rowPassesBrandFilter(r, siteName, seedDomain, competitorDomains));
  if (filtered.length === 0) return [];
  const out: CSVRow[] = [];
  for (let i = 0; i < maxRows; i++) {
    const r = filtered[i % filtered.length]!;
    const title = r.whatToProduce.trim();
    const anchorFirst = firstSegmentFromAnchorCell(r.anchorDemand);
    const keyword = keywordFromAnchorPhrase(anchorFirst.length > 0 ? anchorFirst : title);
    const modifier =
      r.modifier?.trim() || COMPETITOR_CSV_MODIFIER_HINTS[i % COMPETITOR_CSV_MODIFIER_HINTS.length];
    const entity = r.entity?.trim() || brand;
    const featuredImage = normalizeMatrixFeaturedImage(r.featuredImage);
    out.push({
      keyword,
      entity,
      title,
      modifier,
      featuredImage,
    });
  }
  return out;
}

/**
 * Proposal **content blog** CSV: **Content Opportunity Matrix** only (legacy What to Produce / Anchor Demand or bulk keyword|entity|title|modifier|featuredImage), cycled to `maxRows`.
 * Throws if the matrix section is missing or has no usable rows after brand filters.
 */
export function buildProposalMatrixContentCsvRows(options: {
  siteName: string;
  semrush: CompetitorResearchSemrushResponse;
  reportMd: string;
  maxRows: number;
}): CSVRow[] {
  const maxRows = Math.max(0, options.maxRows);
  if (maxRows === 0) return [];
  const matrixRows = extractContentOpportunityMatrixRows(options.reportMd);
  if (matrixRows.length === 0) {
    throw new Error(
      "Proposal requires a Content Opportunity Matrix in the competitor report (Traffic & Intent Gaps). Regenerate the competitor strategist section.",
    );
  }
  const brand = options.siteName.trim() || "Client";
  const competitorDomains = (options.semrush.rows ?? []).map((r) => r.domain);
  const rows = buildRowsFromMatrixRowsCycled(
    matrixRows,
    brand,
    options.siteName,
    options.semrush.seedDomain,
    competitorDomains,
    maxRows,
  );
  if (rows.length === 0) {
    throw new Error(
      "Content Opportunity Matrix has no usable rows after brand filters. Adjust matrix phrases or competitor selection.",
    );
  }
  return rows;
}

function buildRowsFromPool(pool: KeywordPick[], brand: string, maxRows: number): CSVRow[] {
  const rows: CSVRow[] = [];
  for (let i = 0; i < maxRows; i++) {
    const pick = pool[i] ?? pool[pool.length - 1] ?? { phrase: `content pillar ${i + 1}`, sourceDomain: " - " };
    const phrase = pick.phrase.trim();
    const title = phrase;
    const keyword = keywordFromAnchorPhrase(title);
    const modifier = COMPETITOR_CSV_MODIFIER_HINTS[i % COMPETITOR_CSV_MODIFIER_HINTS.length];
    const featuredImage: CSVRow["featuredImage"] = "y";
    rows.push({
      keyword,
      entity: brand,
      title,
      modifier,
      featuredImage,
    });
  }
  return rows;
}

function combinedReportMarkdownForKeywordExtraction(reportMd: string, keywordsMd?: string | null): string {
  const r = reportMd.trim();
  const k = keywordsMd?.trim();
  if (!k) return r;
  return `${r}\n\n${k}`;
}

/**
 * Uses the strategist report’s **Content Opportunity Matrix**: **What to Produce** as the exact post title,
 * **keyword** from **Anchor Demand** (first segment if comma-separated); if Anchor Demand is empty, uses the title.
 * Row order matches M1–M3 in the report. If the matrix table is missing or empty, falls back to **Anchor Demand**
 * phrases, then **Keywords They Own** (Semrush), with title = phrase (no templates).
 */
export function buildCompetitorBulkContentCsvRows(options: {
  siteName: string;
  semrush: CompetitorResearchSemrushResponse;
  /** Markdown strategist report from runCompetitorReportAgent - required for matrix / keyword sourcing. */
  reportMd: string;
  /** Optional Keywords They Own Markdown (same run) - used when the matrix is empty and keywords are not in `reportMd`. */
  keywordsMd?: string | null;
  /** Cap row count (default: {@link COMPETITOR_BULK_CSV_TOTAL_POSTS}). */
  maxRows?: number;
}): CSVRow[] {
  const maxRows = Math.max(0, options.maxRows ?? COMPETITOR_BULK_CSV_TOTAL_POSTS);
  const brand = options.siteName.trim() || "Client";
  const competitorDomains = (options.semrush.rows ?? []).map((r) => r.domain);

  const matrixRows = extractContentOpportunityMatrixRows(options.reportMd);
  if (matrixRows.length > 0) {
    const fromMatrix = buildRowsFromMatrixRows(
      matrixRows,
      brand,
      options.siteName,
      options.semrush.seedDomain,
      competitorDomains,
      maxRows,
    );
    if (fromMatrix.length > 0) return fromMatrix;
    return [];
  }

  const combined = combinedReportMarkdownForKeywordExtraction(options.reportMd, options.keywordsMd);
  const fromMatrix = extractAnchorDemandPhrasesFromContentOpportunityMatrixMarkdown(options.reportMd);
  const raw =
    fromMatrix.length > 0
      ? fromMatrix
      : extractKeywordPhrasesFromCompetitorReportMarkdown(combined);
  if (raw.length === 0) return [];

  const filtered = filterNonBrandedAttackKeywords(
    raw,
    options.siteName,
    options.semrush.seedDomain,
    competitorDomains,
  );
  if (filtered.length === 0) return [];

  const pool: KeywordPick[] = filtered.map((phrase) => ({ phrase, sourceDomain: "report" }));
  return buildRowsFromPool(pool, brand, maxRows);
}

export function downloadCompetitorBulkContentCsv(options: {
  siteName: string;
  semrush: CompetitorResearchSemrushResponse;
  reportMd: string;
  keywordsMd?: string | null;
}): void {
  if (!options.reportMd?.trim()) {
    notify.error(
      "Generate the competitor report first - bulk CSV uses the Content Opportunity Matrix (What to Produce + M1–M3 rows).",
    );
    return;
  }
  const rows = buildCompetitorBulkContentCsvRows(options);
  if (rows.length === 0) {
    notify.error(
      "No usable rows in the report (or only branded terms). Regenerate the report and ensure Traffic & Intent Gaps includes a Content Opportunity Matrix with What to Produce and Anchor Demand (Semrush keyword section is used only if the matrix is empty).",
    );
    return;
  }
  downloadLocalAnalysisBulkCsv(rows, `competitor-bulk-3mo-${COMPETITOR_BULK_CSV_BLOGS_PER_MONTH}pm`);
}
