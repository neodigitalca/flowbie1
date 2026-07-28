import {
  firstCityStateLabelFromAddress,
  streetCorridorLabelFromAddress,
  type LocalDominatorRow,
  weaknessScoreFromKeywordStats,
  type KeywordGridStats,
} from "@/lib/local-dominator-csv";
import {
  LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
} from "@/lib/local-analysis-target-constants";
import { repairSapPageAllocationWeighted } from "@/lib/local-analysis-suggest-keyword-targets";

export type GridLocationBucket = {
  bucketId: string;
  placeLabel: string;
  weight: number;
  avgRank: number;
  rowCount: number;
  sampleAddresses: string[];
};

function bucketStats(rows: LocalDominatorRow[]): { weight: number; avgRank: number } {
  const ranks = rows.map((r) => r.rank);
  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  const minR = Math.min(...ranks);
  const maxR = Math.max(...ranks);
  const above10 = ranks.filter((x) => x > 10).length;
  const pctAbove10 = (above10 / ranks.length) * 100;
  const stats: KeywordGridStats = {
    keyword: "grid",
    count: rows.length,
    avgRank: Math.round(avg * 10) / 10,
    minRank: minR,
    maxRank: maxR,
    pctAbove10: Math.round(pctAbove10 * 10) / 10,
  };
  return { weight: weaknessScoreFromKeywordStats(stats), avgRank: avg };
}

/** Street-corridor buckets from grid Address lines (no house numbers). */
export function buildGridLocationBucketsFromRows(rows: LocalDominatorRow[]): GridLocationBucket[] {
  const byCorridor = new Map<string, LocalDominatorRow[]>();
  for (const r of rows) {
    const corridor = streetCorridorLabelFromAddress(r.address);
    if (!corridor) continue;
    if (!byCorridor.has(corridor)) byCorridor.set(corridor, []);
    byCorridor.get(corridor)!.push(r);
  }

  const buckets: GridLocationBucket[] = [];
  let idx = 0;
  for (const [placeLabel, matched] of byCorridor) {
    const { weight, avgRank } = bucketStats(matched);
    const addresses = [...new Set(matched.map((r) => r.address?.trim()).filter(Boolean))].slice(0, 8);
    buckets.push({
      bucketId: `corridor-${idx++}`,
      placeLabel,
      weight,
      avgRank,
      rowCount: matched.length,
      sampleAddresses: addresses as string[],
    });
  }

  return buckets.sort((a, b) => b.weight - a.weight || a.placeLabel.localeCompare(b.placeLabel));
}

/** City, ST buckets from grid addresses (neighbourhood entity focus; no street corridors). */
export function buildCityLocationBucketsFromRows(rows: LocalDominatorRow[]): GridLocationBucket[] {
  const byCity = new Map<string, LocalDominatorRow[]>();
  for (const r of rows) {
    const city = firstCityStateLabelFromAddress(r.address);
    if (!city) continue;
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city)!.push(r);
  }

  const buckets: GridLocationBucket[] = [];
  let idx = 0;
  for (const [placeLabel, matched] of byCity) {
    const { weight, avgRank } = bucketStats(matched);
    const addresses = [...new Set(matched.map((r) => r.address?.trim()).filter(Boolean))].slice(0, 8);
    buckets.push({
      bucketId: `city-${idx++}`,
      placeLabel,
      weight,
      avgRank,
      rowCount: matched.length,
      sampleAddresses: addresses as string[],
    });
  }

  return buckets.sort((a, b) => b.weight - a.weight || a.placeLabel.localeCompare(b.placeLabel));
}

export function selectGridLocationBucketsForBudget(
  buckets: GridLocationBucket[],
  _totalSap: number,
  _minPerCluster: number = LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
): GridLocationBucket[] {
  return buckets;
}

/** Higher weakness weight → more SAP pages for that grid location. */
export function allocateSapPagesToLocationBuckets(
  buckets: GridLocationBucket[],
  totalSap: number,
  minPer: number = LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
  maxPer: number = 50,
): number[] {
  if (buckets.length === 0) return [];
  const placeholders = buckets.map((b) => ({
    keyword: b.placeLabel,
    sapPages: minPer,
    entityHint: b.placeLabel,
  }));
  const weights = buckets.map((b) => b.weight);
  const repaired = repairSapPageAllocationWeighted(placeholders, weights, totalSap, minPer, maxPer);
  return repaired.map((r) => r.sapPages);
}
