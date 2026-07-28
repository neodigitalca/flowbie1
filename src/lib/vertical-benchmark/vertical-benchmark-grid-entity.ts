import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  CompetitorResearchSemrushResponse,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import {
  defaultSeedEntityHintFromGrid,
  entityMatchesCsvPlaceHints,
} from "@/lib/local-dominator-csv";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import {
  LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
  runLocalStrategySapSchedule,
} from "@/lib/local-strategy-research/local-strategy-sap-schedule-from-grid";
import {
  LOCAL_CSV_WORKER_FILE_BYTES_THRESHOLD,
  processLocalDominatorCsvText,
  type ProcessLocalCsvResult,
} from "@/lib/process-local-dominator-upload";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import type { WordPressSite } from "@/components/integrations/types";
import type { VerticalBenchmarkContentKind } from "@/lib/vertical-benchmark/vertical-benchmark-types";

type BulkBenchmarkModifier =
  | "comparison"
  | "explainer"
  | "guide"
  | "how-to"
  | "product review"
  | "service"
  | "consultation"
  | "opinion"
  | "trends"
  | "future";

function mapSapModifierToBenchmark(raw: string | undefined, title: string): BulkBenchmarkModifier {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (!trimmed || trimmed === "google-maps" || trimmed === "y" || trimmed === "n") {
    if (/\bvs\.?\b|\bversus\b|showdown/i.test(title)) return "comparison";
    if (/\bhow to\b|\bhow-to\b/i.test(title)) return "how-to";
    if (/\bguide\b/i.test(title)) return "guide";
    return "service";
  }
  const allowed: BulkBenchmarkModifier[] = [
    "comparison",
    "explainer",
    "guide",
    "how-to",
    "product review",
    "service",
    "consultation",
    "opinion",
    "trends",
    "future",
  ];
  if (allowed.includes(trimmed as BulkBenchmarkModifier)) return trimmed as BulkBenchmarkModifier;
  if (trimmed.includes("guide")) return "guide";
  if (trimmed.includes("compar")) return "comparison";
  return "service";
}

export type BenchmarkGridCsvContext = Extract<ProcessLocalCsvResult, { ok: true }>;

export type BenchmarkGridEntityBulkRow = {
  keyword: string;
  entity: string;
  title: string;
  modifier: BulkBenchmarkModifier;
  featuredImage: string;
  publish_date_gmt: string;
  clientName: string;
  verifiedBrands: string[];
  gscClicks: number;
  gscImpressions: number;
  contentKind: VerticalBenchmarkContentKind;
};

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TOP_P = 0.9;

/** Uploaded Local Dominator grid is present for this Curate run. */
export function hasBenchmarkGridContext(
  gridContext: BenchmarkGridCsvContext | null | undefined,
): boolean {
  return Boolean(gridContext);
}

/** @deprecated Use hasBenchmarkGridContext — grid augments RAG; does not replace GSC. */
export function usesGridForEntityCurate(
  gridContext: BenchmarkGridCsvContext | null | undefined,
  contentKinds: VerticalBenchmarkContentKind[],
): boolean {
  return hasBenchmarkGridContext(gridContext) && contentKinds.includes("entity");
}

/** GSC fetch always uses the toolbar content kinds; grid is added to prompts separately. */
export function gscContentKindsForBulkCurate(
  contentKinds: VerticalBenchmarkContentKind[],
  _gridContext?: BenchmarkGridCsvContext | null | undefined,
): VerticalBenchmarkContentKind[] {
  return contentKinds;
}

/**
 * GSC Gemini plans: when a grid is loaded, entity URLs are not curated per client —
 * entity rows come once from the grid SAP step at the end of the package.
 */
export function gscPlanContentKindsForBulkCurate(
  contentKinds: VerticalBenchmarkContentKind[],
  gridContext: BenchmarkGridCsvContext | null | undefined,
): VerticalBenchmarkContentKind[] {
  if (!hasBenchmarkGridContext(gridContext) || !contentKinds.includes("entity")) {
    return contentKinds;
  }
  return contentKinds.filter((k) => k !== "entity");
}

/** Place hints + per-city weakness labels used to match entity row geo text. */
export function gridPlaceHintsForMatching(grid: BenchmarkGridCsvContext): string[] {
  const hints = [...grid.placeHints];
  for (const pw of grid.placeWeaknessWeights ?? []) {
    const place = pw.place?.trim();
    if (place) hints.push(place);
  }
  return [...new Set(hints)];
}

/** True when combined title/entity/keyword text mentions a city from the uploaded grid. */
export function textMatchesBenchmarkGridPlaces(
  text: string,
  grid: BenchmarkGridCsvContext,
): boolean {
  const hints = gridPlaceHintsForMatching(grid);
  if (!text.trim() || hints.length === 0) return false;
  return entityMatchesCsvPlaceHints(text, hints);
}

export type BulkRowGridFootprintFields = {
  contentKind: VerticalBenchmarkContentKind;
  title: string;
  entity?: string;
  keyword: string;
};

/** Drop entity rows whose geo text is outside the grid footprint; keep all post rows. */
export function filterBulkSheetToGridFootprint<T extends BulkRowGridFootprintFields>(
  rows: T[],
  grid: BenchmarkGridCsvContext,
): { kept: T[]; dropped: T[] } {
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const row of rows) {
    if (row.contentKind !== "entity") {
      kept.push(row);
      continue;
    }
    const combined = `${row.entity ?? ""} ${row.title} ${row.keyword}`.trim();
    if (textMatchesBenchmarkGridPlaces(combined, grid)) {
      kept.push(row);
    } else {
      dropped.push(row);
    }
  }
  return { kept, dropped };
}

export type GridEntityPackageSite = {
  site: WordPressSite;
  siteUrl: string;
  siteName: string;
  clientOfferingsBlock: string;
  verifiedBrands: string[];
};

/** In-memory grid evidence appended to GSC RAG prompts (not a replacement for GSC URLs). */
export function buildBenchmarkGridRagBlock(grid: BenchmarkGridCsvContext): string {
  const hints =
    grid.placeHints.length > 0 ?
      grid.placeHints.slice(0, 30).join("; ")
    : "(none parsed)";
  return `=== LOCAL_DOMINATOR_GRID (in memory — use with GSC lines below) ===
Dominant keyword: ${grid.dominantKeyword}
Nearby / weak-rank place hints: ${hints}
${grid.gridSummaryMarkdown.trim()}
=== END LOCAL_DOMINATOR_GRID ===`;
}

export async function parseBenchmarkGridCsv(
  text: string,
  fileSizeBytes: number,
): Promise<ProcessLocalCsvResult> {
  const useWorker = fileSizeBytes >= LOCAL_CSV_WORKER_FILE_BYTES_THRESHOLD;
  return processLocalDominatorCsvText(text, useWorker);
}

export function buildBenchmarkSemrushStub(siteUrl: string): CompetitorResearchSemrushResponse {
  let host = siteUrl.trim();
  try {
    host = normalizeCompetitorDomainKey(
      host.includes("://") ? host : `https://${host}`,
    );
  } catch {
    host = siteUrl.trim() || "client";
  }
  return {
    seedDomain: host,
    database: "us",
    dataSource: "dfs",
    rows: [],
    seedTopKeywords: [],
  };
}

export function buildBenchmarkTiersStub(seedDomain: string): TieredCompetitorsResult {
  return {
    summary: "Benchmark grid entity (client seed only)",
    tiers: [
      {
        tier: "high",
        label: "Seed",
        competitors: [{ domain: seedDomain, score: 100, rationale: "Curated client" }],
      },
    ],
  };
}

/** Map SAP bulk row → benchmark CSV row (modifier is content-type, not google-maps). */
export function sapRowsToBenchmarkEntityBulkRows(
  sapRows: CSVRow[],
  clientName: string,
  verifiedBrands: string[],
): BenchmarkGridEntityBulkRow[] {
  const out: BenchmarkGridEntityBulkRow[] = [];
  for (const row of sapRows) {
    const keyword = row.keyword?.trim() ?? "";
    const title = row.title?.trim() ?? "";
    if (!keyword || !title) continue;
    const modifier = mapSapModifierToBenchmark(row.modifier, title);
    out.push({
      keyword,
      entity: row.entity?.trim() ?? "",
      title,
      modifier,
      featuredImage: (row.featuredImage?.trim() || "y") === "n" ? "n" : "y",
      publish_date_gmt: "",
      clientName,
      verifiedBrands,
      gscClicks: 0,
      gscImpressions: 0,
      contentKind: "entity",
    });
  }
  return out;
}

export type BuildBenchmarkEntityRowsFromGridParams = {
  site: WordPressSite;
  siteUrl: string;
  siteName: string;
  clientOfferingsBlock: string;
  verifiedBrands: string[];
  gridContext: BenchmarkGridCsvContext;
  openRouterApiKey: string;
  geoLabel?: string | null;
  entityLocation?: string | null;
  targetTotal?: number;
};

/**
 * Per-client entity bulk rows from shared grid CSV (SAP schedule: weighted keywords, grid summary LLM or direct pins).
 */
export async function buildBenchmarkEntityRowsFromGrid(
  params: BuildBenchmarkEntityRowsFromGridParams,
): Promise<BenchmarkGridEntityBulkRow[]> {
  const apiKey = params.openRouterApiKey.trim();
  if (!apiKey) return [];

  const grid = params.gridContext;
  const siteUrl = params.siteUrl.trim() || getPublicSiteUrl(params.site);
  const semrush = buildBenchmarkSemrushStub(siteUrl);
  const tiers = buildBenchmarkTiersStub(semrush.seedDomain);
  const seedKey = normalizeCompetitorDomainKey(semrush.seedDomain);

  const entityLocation =
    params.entityLocation === null && params.geoLabel === null
      ? defaultSeedEntityHintFromGrid(grid.placeHints, []) || undefined
      : params.entityLocation?.trim() ||
        defaultSeedEntityHintFromGrid(grid.placeHints, [
          params.geoLabel?.trim() ?? "",
        ]) ||
        undefined;

  const targetTotal = Math.min(
    params.targetTotal ?? LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
    grid.gridRowsForDirectSap.length || LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
  );

  const model = getResearchModel(params.site.id);
  const { sapRows } = await runLocalStrategySapSchedule({
    apiKey,
    model,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    topP: DEFAULT_TOP_P,
    siteId: params.site.id,
    siteName: params.siteName,
    siteUrl,
    entityLocation: entityLocation ?? null,
    geoLabel: params.geoLabel ?? null,
    semrush,
    tiers,
    selectedDomainKeys: new Set([seedKey]),
    gridSummaryMarkdown: grid.gridSummaryMarkdown,
    gridPlaceHints: grid.placeHints,
    gridKeywordWeights: grid.gridKeywordWeights,
    gridParsedRows: grid.gridRowsForDirectSap,
    targetTotal: Math.max(1, targetTotal),
  });

  return sapRowsToBenchmarkEntityBulkRows(sapRows, params.siteName, params.verifiedBrands);
}

/**
 * One SAP schedule for the whole export package (not per client). Rows are tagged with
 * client names round-robin when multiple roster clients are selected.
 */
export async function buildBenchmarkEntityRowsOnceForPackage(params: {
  gridContext: BenchmarkGridCsvContext;
  packageSites: GridEntityPackageSite[];
  openRouterApiKey: string;
}): Promise<BenchmarkGridEntityBulkRow[]> {
  const sites = params.packageSites;
  const anchor = sites[0];
  if (!anchor) return [];

  const rows = await buildBenchmarkEntityRowsFromGrid({
    site: anchor.site,
    siteUrl: anchor.siteUrl,
    siteName: anchor.siteName,
    clientOfferingsBlock: anchor.clientOfferingsBlock,
    verifiedBrands: anchor.verifiedBrands,
    gridContext: params.gridContext,
    openRouterApiKey: params.openRouterApiKey,
    entityLocation: null,
    geoLabel: null,
  });

  if (sites.length <= 1) return rows;

  return rows.map((row, i) => {
    const slot = sites[i % sites.length]!;
    return {
      ...row,
      clientName: slot.siteName,
      verifiedBrands: slot.verifiedBrands,
    };
  });
}
