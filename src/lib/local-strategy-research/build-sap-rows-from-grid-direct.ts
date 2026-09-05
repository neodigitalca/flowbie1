import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type {
  CompetitorResearchSemrushResponse,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import {
  buildLocalGridSummary,
  dominantKeywordFromRows,
  firstCityStateLabelFromAddress,
  lastCityStateLabelFromAddress,
  wikipediaSearchAugmentFromGridRows,
  type LocalDominatorRow,
} from "@/lib/local-dominator-csv";
import {
  LOCAL_ANALYSIS_SAP_MIN,
} from "@/lib/local-analysis-target-constants";
import {
  buildCityLocationBucketsFromRows,
  type GridLocationBucket,
} from "@/lib/local-analysis/grid-location-buckets";
import { dedupeRepeatedCommaPlaceSegments, mergePlaceHintWithGeoSuffix, normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import {
  harvestWikiPlacesForCity,
  pickWikiEntriesFromPool,
} from "@/lib/wikipedia/wiki-entity-pool";

function clampTargetTotal(n: number): number {
  return Math.max(LOCAL_ANALYSIS_SAP_MIN, Math.floor(n));
}

/** Strip GMB listing fluff sometimes present in grid address cells. */
function stripGmbListingFluff(label: string): string {
  return label
    .replace(/\d+\+\s*years?\s+in\s+business\s*·?\s*/gi, "")
    .replace(/\s*·\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim();
}

/** Entity/title place label: prefer City, ST from address; never use raw GMB attribute text. */
export function sanitizeGridSapPlaceLabel(label: string): string {
  const trimmed = stripGmbListingFluff(label.trim());
  if (!trimmed) return "";
  const citySt =
    (trimmed.includes(",") && trimmed.length > 40
      ? lastCityStateLabelFromAddress(trimmed)
      : null) ?? firstCityStateLabelFromAddress(trimmed);
  if (citySt) return dedupeRepeatedCommaPlaceSegments(citySt);
  return dedupeRepeatedCommaPlaceSegments(trimmed);
}

/**
 * Prefer last three comma-separated segments (neighborhood, city, province/state) when present.
 */
export function entityFromGridRow(
  row: LocalDominatorRow,
  placeHints: string[],
  geoSuffix: string,
  index: number,
): string {
  const addr = row.address?.trim();
  if (addr) {
    const fromAddr = sanitizeGridSapPlaceLabel(addr);
    if (fromAddr) return fromAddr;
  }
  if (placeHints.length > 0) {
    const h = sanitizeGridSapPlaceLabel(placeHints[index % placeHints.length]!);
    const suffix = sanitizeGridSapPlaceLabel(geoSuffix);
    return suffix ? mergePlaceHintWithGeoSuffix(h, suffix) : h;
  }
  const fallback = sanitizeGridSapPlaceLabel(geoSuffix || row.keyword.trim() || "Unknown");
  return fallback || "Unknown";
}

function tierLabelForSeed(semrush: CompetitorResearchSemrushResponse, tiers: TieredCompetitorsResult): string {
  const seed = normalizeCompetitorDomainKey(semrush.seedDomain ?? "");
  for (const g of tiers.tiers) {
    for (const c of g.competitors) {
      if (normalizeCompetitorDomainKey(c.domain) === seed) {
        return `${g.label} (${g.tier})`;
      }
    }
  }
  return seed || "seed";
}

export type BuildSapRowsFromGridDirectParams = {
  rows: LocalDominatorRow[];
  targetTotal: number;
  placeHints: string[];
  geoLabel: string | null;
  entityLocation: string | null;
  semrush: CompetitorResearchSemrushResponse;
  tiers: TieredCompetitorsResult;
};

export type BuildSapRowsFromGridDirectWikiParams = BuildSapRowsFromGridDirectParams & {
  apiKey: string;
  siteId?: string;
};

function parentCityFromBucket(bucket: GridLocationBucket): string {
  for (const addr of bucket.sampleAddresses) {
    const city = firstCityStateLabelFromAddress(addr);
    if (city) return normalizeEntityHintCommaLabel(city);
  }
  return normalizeEntityHintCommaLabel(bucket.placeLabel.trim());
}

/**
 * SAP bulk rows from grid pins with entities from Wikipedia harvest → AI pick (exactly one entity per row).
 */
export async function buildSapRowsFromGridDirectWithWikiPool(
  params: BuildSapRowsFromGridDirectWikiParams,
): Promise<CSVRow[]> {
  const target = clampTargetTotal(params.targetTotal);
  if (params.rows.length === 0) {
    return [];
  }
  if (!params.apiKey.trim()) {
    throw new Error("OpenRouter API key is required for wiki pool grid SAP rows.");
  }

  const buckets = buildCityLocationBucketsFromRows(params.rows);
  const bucket = buckets[0];
  if (!bucket) {
    throw new Error("Grid CSV has no city buckets for wiki pool SAP rows.");
  }

  const hints = params.placeHints.map((h) => h.trim()).filter(Boolean);
  const parentCity = parentCityFromBucket(bucket);
  const gridSummaryMarkdown = buildLocalGridSummary(params.rows, {
    rowsForGeographicScope: params.rows,
  }).summaryMarkdown;
  const wikipediaSearchAugment = wikipediaSearchAugmentFromGridRows(params.rows);
  const { pool } = await harvestWikiPlacesForCity({
    bucket,
    gridPlaceHints: hints,
    minCount: target,
    wikipediaSearchAugment,
  });
  const picked = await pickWikiEntriesFromPool({
    pool,
    count: target,
    parentCity,
    sampleAddresses: bucket.sampleAddresses,
    gridLocations: hints,
    gridSummaryMarkdown,
    excludeTitles: [],
    apiKey: params.apiKey,
    siteId: params.siteId,
  });

  const originBits = [
    params.semrush.seedDomain?.trim() ? `seed:${params.semrush.seedDomain.trim()}` : "",
    tierLabelForSeed(params.semrush, params.tiers),
  ]
    .filter(Boolean)
    .join(" · ");

  const sorted = [...params.rows].sort((a, b) => b.rank - a.rank);
  const slice = sorted.slice(0, target);
  if (picked.length === 0) {
    return [];
  }

  return slice.map((row, i) => {
    const entry = picked[i % picked.length]!;
    const entity = normalizeEntityHintCommaLabel(entry.entityLabel);
    return {
      keyword: row.keyword.trim(),
      entity,
      title: "",
      modifier: "google-maps",
      featuredImage: "google-maps",
      keyword_questions_json: "[]",
      origin: originBits || undefined,
      wikipedia_url: entry.wikipediaUrl,
      wikipedia_title: entry.wikipediaTitle,
    };
  });
}

/**
 * Deterministic SAP bulk rows from Local Dominator grid pins + local analysis context (no LLM).
 * Rows are worst-rank-first (higher rank number = worse position), capped to targetTotal.
 */
export function buildSapRowsFromGridDirect(params: BuildSapRowsFromGridDirectParams): CSVRow[] {
  const target = clampTargetTotal(params.targetTotal);
  if (params.rows.length === 0) {
    return [];
  }

  const geoSuffix = sanitizeGridSapPlaceLabel(
    [params.geoLabel?.trim(), params.entityLocation?.trim()].filter(Boolean).join(", ").trim(),
  );
  const hints = params.placeHints.map((h) => h.trim()).filter(Boolean);
  const originBits = [
    params.semrush.seedDomain?.trim() ? `seed:${params.semrush.seedDomain.trim()}` : "",
    tierLabelForSeed(params.semrush, params.tiers),
  ]
    .filter(Boolean)
    .join(" · ");

  const sorted = [...params.rows].sort((a, b) => b.rank - a.rank);
  const slice = sorted.slice(0, target);

  return slice.map((row, i) => {
    const entity = entityFromGridRow(row, hints, geoSuffix, i);
    return {
      keyword: row.keyword.trim(),
      entity,
      title: "",
      modifier: "google-maps",
      featuredImage: "google-maps",
      keyword_questions_json: "[]",
      origin: originBits || undefined,
    };
  });
}
