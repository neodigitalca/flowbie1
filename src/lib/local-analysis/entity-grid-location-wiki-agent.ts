import type { GridKeywordWeight } from "@/lib/process-local-dominator-upload";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { GscSiteQueryRow } from "@/lib/competitor-research/types";
import { gscSapKeywordBasesForOpenRouter, brandExclusionPhrasesFromNames } from "@/lib/bulk/bulk-gsc-site-queries";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { SuggestedKeywordTarget } from "@/lib/local-analysis-suggest-keyword-targets";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import {
  sanitizeUniqueServiceKeywordsForAdGroup,
  sapKeywordFromShortBaseAndEntity,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import { checkWikipediaPageExists } from "@/lib/wikipedia/mediawiki-search";
import { fetchWikipediaIntroPlainText } from "@/lib/wikipedia/mediawiki-intro";
import {
  isAcceptedWikiPlaceValidation,
  validateWikipediaPlacePage,
  type WikiPlaceValidationTier,
} from "@/lib/wikipedia/validate-wikipedia-place-page-openrouter";
import {
  buildClusterWikiCandidateTiers,
  clusterCityWikiTitle,
  isRejectedClusterWikiTitle,
  isRejectedNeighbourhoodWikiTitle,
} from "@/lib/local-analysis/cluster-wiki-candidates";
import { wikipediaArticleUrl } from "@/lib/wikipedia/wiki-urls";
import {
  buildCityLocationBucketsFromRows,
  buildGridLocationBucketsFromRows,
  type GridLocationBucket,
} from "@/lib/local-analysis/grid-location-buckets";
import { repairSapPageAllocationWeighted } from "@/lib/local-analysis-suggest-keyword-targets";
import {
  firstCityStateLabelFromAddress,
  isStreetCorridorPlaceLabel,
  type LocalDominatorRow,
} from "@/lib/local-dominator-csv";
import {
  LOCAL_ANALYSIS_SAP_MAX,
  LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
} from "@/lib/local-analysis-target-constants";
import { entityTypeFocusWantsNeighbourhoods } from "@/lib/entity-geographic-level";

const OR = "https://openrouter.ai/api/v1/chat/completions";

const NEIGHBOURHOOD_PICK_SYSTEM = `Pick neighbourhood / district AdGroups for a grid city cluster, ranked by POS (grid pin weakness).

Output **only** valid JSON:
{"entities":[{"name":"Neighbourhood, City, ST","posWeight":12.5}, ...]}

Rules:
- Return **exactly** \`count\` distinct AdGroups in \`entities\`.
- **name:** neighbourhood or district first, then city, then province/state (e.g. "Mill Woods, Edmonton, AB").
- **posWeight:** positive number from grid POS — higher when more/weaker pins in \`sampleAddresses\` fall in that neighbourhood (more SAP pages later).
- **Forbidden:** metro/city-only labels (e.g. "Edmonton, AB"), street names, avenues, roads, highways, corridors, bare addresses.
- \`gridPlaceLabel\` is the city anchor; use \`sampleAddresses\` to infer real neighbourhoods that contain those pins.
- Must match \`gridLocations\` / \`sampleAddresses\` from the uploaded grid.
- Must **not** repeat any name in \`entitiesAlreadyUsed\` or within your own \`entities\` list.`;

export type NeighbourhoodPick = {
  name: string;
  /** Relative POS weakness; higher → more pages in the AdGroup. */
  posWeight: number;
};
export function isCityLevelOnlyEntity(entity: string, cityLabel: string | null | undefined): boolean {
  const norm = normalizeEntityHintCommaLabel(entity);
  if (!norm) return true;
  const parts = norm.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  const city = normalizeEntityHintCommaLabel(cityLabel ?? "");
  if (!city) {
    return parts.length <= 2;
  }
  const cityParts = city.split(",").map((s) => s.trim()).filter(Boolean);
  const cityName = (cityParts[0] ?? "").toLowerCase();
  const first = (parts[0] ?? "").toLowerCase();
  if (norm.toLowerCase() === city.toLowerCase()) return true;
  if (first === cityName && parts.length <= Math.max(cityParts.length, 2)) return true;
  return false;
}

/** Service keyword + entity place (no duplicated city/neighbourhood tokens). */
export function combineKeywordWithFullEntity(baseKeyword: string, entity: string): string {
  return sapKeywordFromShortBaseAndEntity(baseKeyword, entity);
}

export type GridClusterWikipedia = {
  gridPlaceLabel: string;
  title: string;
  url: string;
};

type ResolvedGridCluster = {
  bucket: GridLocationBucket;
  entity: string;
  baseKeywords: string[];
  wiki: GridClusterWikipedia;
};

function sapMinPerClusterForBudget(totalSapBudget: number): number {
  return Math.min(LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET, Math.max(1, totalSapBudget));
}

function maxClustersForBudget(totalSapBudget: number): number {
  if (totalSapBudget < 1) return 0;
  const minPer = sapMinPerClusterForBudget(totalSapBudget);
  return Math.max(1, Math.floor(totalSapBudget / minPer));
}

function uniqueBucketsForClusters(buckets: GridLocationBucket[], clusterCap: number): GridLocationBucket[] {
  const cap = Math.max(1, clusterCap);
  const out: GridLocationBucket[] = [];
  const seen = new Set<string>();
  for (const bucket of buckets) {
    const key = bucket.placeLabel.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(bucket);
    if (out.length >= cap) break;
  }
  return out;
}

function sapPagesPerBucket(
  buckets: GridLocationBucket[],
  totalSapBudget: number,
): number[] {
  const minPer = sapMinPerClusterForBudget(totalSapBudget);
  const weights = buckets.map((b) => b.weight);
  const placeholders = buckets.map((bucket, i) => ({
    keyword: `cluster-${i}`,
    sapPages: minPer,
    entityHint: bucket.placeLabel,
  }));
  const allocated = repairSapPageAllocationWeighted(
    placeholders,
    weights,
    totalSapBudget,
    minPer,
    LOCAL_ANALYSIS_SAP_MAX,
  );
  const counts = allocated.map((r) => r.sapPages);
  return counts;
}

/** Service-only GSC bases for SAP rows (no city — entity AdGroup holds the place). */
function gscKeywordsForRows(
  gscQueries: GscSiteQueryRow[],
  rowCount: number,
  excludeBrandPhrases: readonly string[],
): string[] {
  const pool = gscSapKeywordBasesForOpenRouter(
    gscQueries,
    Math.max(rowCount * 4, rowCount),
    excludeBrandPhrases,
  );
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const kw of pool) {
    const t = kw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  return unique;
}

/** Pull `need` unique service keywords for one AdGroup from a shared GSC pool. */
function takeUniqueServiceKeywordsForAdGroup(
  pool: string[],
  cursor: { i: number },
  need: number,
  entity: string,
  placeCorpus: readonly string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const tryAdd = (raw: string) => {
    if (out.length >= need) return;
    const cleanedList = sanitizeUniqueServiceKeywordsForAdGroup([raw], entity, placeCorpus);
    const cleaned = cleanedList[0];
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };
  while (out.length < need && cursor.i < pool.length) {
    tryAdd(pool[cursor.i++]!);
  }
  if (out.length < need) {
    for (const raw of pool) {
      if (out.length >= need) break;
      tryAdd(raw);
    }
  }
  return out;
}

/** Neighbourhood / district entities for a city grid bucket (Clusters + Entity preload). */
export async function pickNeighbourhoodEntitiesForCluster(
  bucket: GridLocationBucket,
  gridLocations: string[],
  entitiesAlreadyUsed: string[],
  count: number,
  apiKey: string,
  siteId: string | undefined,
): Promise<NeighbourhoodPick[]> {
  const n = Math.max(1, Math.floor(count));
  try {
    const res = await fetch(OR, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://flowbie.app",
        "X-Title": "Flowbie Neighbourhood Pick",
      },
      body: JSON.stringify({
        model: getResearchModel(siteId),
        messages: [
          { role: "system", content: NEIGHBOURHOOD_PICK_SYSTEM },
          {
            role: "user",
            content: JSON.stringify({
              count: n,
              gridPlaceLabel: bucket.placeLabel,
              sampleAddresses: bucket.sampleAddresses.slice(0, 8),
              gridLocations,
              entitiesAlreadyUsed,
              bucketWeight: bucket.weight,
              bucketAvgRank: bucket.avgRank,
            }),
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        stream: false,
      }),
    });

    if (!res.ok) return [];

    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = j.choices?.[0]?.message?.content ?? "";
    if (!raw.trim()) return [];

    const parsed = JSON.parse(raw) as { entities?: unknown; entity?: unknown };
    const list: NeighbourhoodPick[] = [];
    if (Array.isArray(parsed.entities)) {
      for (const item of parsed.entities) {
        if (typeof item === "string" && item.trim()) {
          list.push({ name: item.trim(), posWeight: 1 });
          continue;
        }
        if (item && typeof item === "object") {
          const rec = item as { name?: unknown; posWeight?: unknown; entity?: unknown };
          const name = String(rec.name ?? rec.entity ?? "").trim();
          if (!name) continue;
          const w = Number(rec.posWeight);
          list.push({
            name,
            posWeight: Number.isFinite(w) && w > 0 ? w : 1,
          });
        }
      }
    } else if (typeof parsed.entity === "string" && parsed.entity.trim()) {
      list.push({ name: parsed.entity.trim(), posWeight: 1 });
    }
    return list.slice(0, n);
  } catch {
    return [];
  }
}

/**
 * Split city-bucket SAP pages across neighbourhood AdGroups by POS weights.
 * Fewer AdGroups than pages so each group gets multiple keywords when budget allows.
 */
export function allocatePagesAcrossNeighbourhoodPicks(
  picks: NeighbourhoodPick[],
  totalPages: number,
): Array<{ entity: string; pages: number; posWeight: number }> {
  if (totalPages < 1 || picks.length === 0) return [];
  const groupCap = Math.min(picks.length, maxClustersForBudget(totalPages));
  const capped = picks.slice(0, Math.max(1, groupCap));
  const minPer = sapMinPerClusterForBudget(totalPages);
  const placeholders = capped.map((p, i) => ({
    keyword: p.name.trim() || `nh-${i}`,
    sapPages: minPer,
    entityHint: p.name.trim(),
  }));
  const weights = capped.map((p) => (p.posWeight > 0 ? p.posWeight : 1));
  const allocated = repairSapPageAllocationWeighted(
    placeholders,
    weights,
    totalPages,
    minPer,
    LOCAL_ANALYSIS_SAP_MAX,
  );
  return allocated.map((row, i) => ({
    entity: capped[i]?.name.trim() || row.entityHint || row.keyword,
    pages: row.sapPages,
    posWeight: capped[i]?.posWeight ?? 1,
  }));
}

function cityFromBucket(bucket: GridLocationBucket): string | null {
  for (const addr of bucket.sampleAddresses) {
    const city = firstCityStateLabelFromAddress(addr);
    if (city) return city;
  }
  return null;
}

/** Verified Wikipedia: neighbourhood → city + region → province. */
async function resolveClusterWiki(
  entity: string,
  bucket: GridLocationBucket,
  apiKey: string,
  siteId: string | undefined,
): Promise<GridClusterWikipedia> {
  const tiers = buildClusterWikiCandidateTiers(entity, bucket);
  const geo = tiers.geo;
  const model = getResearchModel(siteId);

  const tryCandidates = async (
    candidates: string[],
    reject: (title: string) => boolean,
    tier: WikiPlaceValidationTier,
  ): Promise<{ title: string; url: string; candidate: string } | null> => {
    for (const candidate of candidates) {
      const ex = await checkWikipediaPageExists(candidate);
      if (!ex.exists || !ex.title || !ex.url) continue;
      if (reject(ex.title)) continue;
      if (geo?.city) {
        const intro = await fetchWikipediaIntroPlainText(ex.title, 600);
        const validation = await validateWikipediaPlacePage({
          apiKey,
          model,
          siteId,
          entity,
          candidateTitle: candidate,
          resolvedTitle: ex.title,
          expectedCity: geo.city,
          expectedRegion: geo.regionName,
          intro,
        });
        if (!isAcceptedWikiPlaceValidation(validation, tier)) continue;
      }
      return { title: ex.title, url: ex.url, candidate };
    }
    return null;
  };

  const rejectCity = (title: string) => isRejectedClusterWikiTitle(title, geo);
  const rejectNeighbourhood = (title: string) => isRejectedNeighbourhoodWikiTitle(title, geo);

  const resolved =
    (await tryCandidates(tiers.neighbourhood, rejectNeighbourhood, "neighbourhood")) ??
    (await tryCandidates(tiers.city, rejectCity, "city"));

  if (resolved) {
    return {
      gridPlaceLabel: bucket.placeLabel,
      title: resolved.title,
      url: resolved.url,
    };
  }

  const cityTitle = geo
    ? clusterCityWikiTitle(geo)
    : tiers.city[0]?.trim() || cityFromBucket(bucket) || entity.trim() || bucket.placeLabel;
  return {
    gridPlaceLabel: bucket.placeLabel,
    title: cityTitle,
    url: wikipediaArticleUrl(cityTitle),
  };
}

async function resolveGridCluster(
  entity: string,
  bucket: GridLocationBucket,
  apiKey: string,
  siteId: string | undefined,
): Promise<GridClusterWikipedia> {
  return resolveClusterWiki(entity, bucket, apiKey, siteId);
}

function buildWikiMarkdown(entries: GridClusterWikipedia[]): string {
  const lines = ["**Grid cluster Wikipedia (neighbourhood articles):**", ""];
  for (const e of entries) {
    lines.push(`### ${e.title}`);
    lines.push(`- Grid pins: ${e.gridPlaceLabel}`);
    lines.push(`- URL: ${e.url}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function clusterSapRowsFromResolved(clusters: ResolvedGridCluster[]): CSVRow[] {
  const out: CSVRow[] = [];
  for (const c of clusters) {
    for (const _baseKeyword of c.baseKeywords) {
      out.push({
        keyword: "",
        entity: normalizeEntityHintCommaLabel(c.entity),
        title: "",
        modifier: "",
        featuredImage: "google-maps",
        wikipedia_url: c.wiki.url,
        wikipedia_title: c.wiki.title,
      });
    }
  }
  return out;
}

/** Stamp verified Wikipedia on rows whose entity is the neighbourhood article title. */
export function applyGridClusterWikipediaToSapRows(
  rows: CSVRow[],
  clusterWikipedia: GridClusterWikipedia[],
): CSVRow[] {
  const byTitle = new Map(clusterWikipedia.map((w) => [w.title.trim().toLowerCase(), w]));
  return rows.map((row) => {
    if (row.wikipedia_url?.trim()) return row;
    const key = (row.entity ?? "").trim().toLowerCase();
    const wiki = byTitle.get(key);
    if (!wiki) return row;
    return {
      ...row,
      wikipedia_url: wiki.url,
      wikipedia_title: wiki.title,
    };
  });
}

export type EntityGridLocationClusterResult = {
  suggestedTargets: SuggestedKeywordTarget[];
  sapRows: CSVRow[];
  wikiEntityPoolTitles: string[];
  wikiMarkdown: string;
  bucketsUsed: GridLocationBucket[];
  clusterWikipedia: GridClusterWikipedia[];
};

export type EntityLocationClusterFromBucketsOptions = {
  apiKey: string;
  siteId?: string;
  buckets: GridLocationBucket[];
  gscQueries: GscSiteQueryRow[];
  gridLocations: string[];
  totalSapBudget: number;
  entityGeographicLevel?: import("@/lib/entity-geographic-level").EntityGeographicLevel;
  entityTypeFocus?: string[];
  businessName?: string;
  siteName?: string;
  onClusterProgress?: (done: number, total: number, placeLabel: string, cumulativeSapRows: number) => void;
};

export type EntityGridLocationClusterOptions = EntityLocationClusterFromBucketsOptions & {
  gridRows: LocalDominatorRow[];
  gridKeywordWeights: GridKeywordWeight[];
};

export async function runEntityLocationClusterFromBuckets(
  options: EntityLocationClusterFromBucketsOptions,
): Promise<EntityGridLocationClusterResult> {
  const {
    apiKey,
    siteId,
    buckets: allBuckets,
    gscQueries,
    gridLocations,
    totalSapBudget,
    entityTypeFocus,
    businessName,
    siteName,
    onClusterProgress,
  } = options;
  if (!apiKey.trim()) {
    throw new Error("OpenRouter API key is required for neighbourhood clustering.");
  }
  if (allBuckets.length === 0) {
    throw new Error("No location buckets found for clustering.");
  }
  if (gscQueries.length === 0) {
    throw new Error("GSC keywords are empty. Connect GSC before running Clusters.");
  }

  const wantsNeighbourhoods = entityTypeFocusWantsNeighbourhoods(entityTypeFocus);
  const clusterCap = maxClustersForBudget(totalSapBudget);

  const candidateBuckets = uniqueBucketsForClusters(allBuckets, clusterCap);
  if (candidateBuckets.length === 0) {
    throw new Error("No unique grid locations for clusters.");
  }

  const sapCounts = sapPagesPerBucket(candidateBuckets, totalSapBudget);
  const bucketsToRun = candidateBuckets.slice(0, sapCounts.length);
  const totalRows = sapCounts.reduce((sum, n) => sum + n, 0);
  const brandPhrases = brandExclusionPhrasesFromNames(businessName, siteName);
  const gscKeywords = gscKeywordsForRows(gscQueries, totalRows, brandPhrases);
  const placeCorpus = [
    ...gridLocations,
    ...bucketsToRun.map((b) => b.placeLabel),
  ];
  const maxClusters = bucketsToRun.length;
  const entitiesUsed: string[] = [];
  const usedKeys = new Set<string>();

  const clusterPlans: Array<{
    bucket: GridLocationBucket;
    entity: string;
    baseKeywords: string[];
    sapPageCount: number;
  }> = [];
  const keywordCursor = { i: 0 };
  let cumulativeSapRows = 0;

  for (let i = 0; i < bucketsToRun.length; i++) {
    const bucket = bucketsToRun[i]!;
    const sapPageCount = sapCounts[i] ?? LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET;
    const cityLabel = cityFromBucket(bucket) ?? bucket.placeLabel.trim();

    if (wantsNeighbourhoods) {
      const adGroupCount = Math.max(1, maxClustersForBudget(sapPageCount));
      const picked = await pickNeighbourhoodEntitiesForCluster(
        bucket,
        gridLocations,
        entitiesUsed,
        adGroupCount,
        apiKey,
        siteId,
      );
      const validPicks: NeighbourhoodPick[] = [];
      for (const pick of picked) {
        const entity = normalizeEntityHintCommaLabel(pick.name);
        if (!entity || isStreetCorridorPlaceLabel(entity)) continue;
        if (isCityLevelOnlyEntity(entity, cityLabel)) continue;
        const key = entity.trim().toLowerCase();
        if (usedKeys.has(key)) continue;
        usedKeys.add(key);
        entitiesUsed.push(entity);
        validPicks.push({ name: entity, posWeight: pick.posWeight });
      }
      const allocations = allocatePagesAcrossNeighbourhoodPicks(validPicks, sapPageCount);
      for (const alloc of allocations) {
        const pages = Math.max(1, alloc.pages);
        const kws = takeUniqueServiceKeywordsForAdGroup(
          gscKeywords,
          keywordCursor,
          pages,
          alloc.entity,
          placeCorpus,
        );
        if (kws.length === 0) continue;
        clusterPlans.push({
          bucket,
          entity: alloc.entity,
          baseKeywords: kws,
          sapPageCount: kws.length,
        });
        cumulativeSapRows += kws.length;
        onClusterProgress?.(i + 1, maxClusters, alloc.entity, cumulativeSapRows);
      }
      continue;
    }

    const entity = normalizeEntityHintCommaLabel(bucket.placeLabel.trim());
    if (!entity) continue;
    entitiesUsed.push(entity);
    const baseKeywords = takeUniqueServiceKeywordsForAdGroup(
      gscKeywords,
      keywordCursor,
      sapPageCount,
      entity,
      placeCorpus,
    );
    if (baseKeywords.length === 0) continue;
    clusterPlans.push({
      bucket,
      entity,
      baseKeywords,
      sapPageCount: baseKeywords.length,
    });
    cumulativeSapRows += baseKeywords.length;
    onClusterProgress?.(i + 1, maxClusters, entity || bucket.placeLabel, cumulativeSapRows);
  }

  if (clusterPlans.length === 0) {
    throw new Error(
      wantsNeighbourhoods
        ? "No neighbourhood entities returned. Neighbourhoods focus does not use city-level ad groups."
        : "No location clusters produced.",
    );
  }

  const resolvedClusters = await Promise.all(
    clusterPlans.map(async (plan) => {
      const wiki = await resolveGridCluster(plan.entity, plan.bucket, apiKey, siteId);
      return {
        bucket: plan.bucket,
        entity: plan.entity,
        baseKeywords: plan.baseKeywords,
        wiki,
      } satisfies ResolvedGridCluster;
    }),
  );

  const suggestedTargets: SuggestedKeywordTarget[] = resolvedClusters.map((c) => ({
    keyword: combineKeywordWithFullEntity(c.baseKeywords[0] ?? "", c.entity),
    sapPages: c.baseKeywords.length,
    entityHint: c.entity,
    clusterId: c.bucket.bucketId,
    clusterRole: "seed" as const,
  }));

  const clusterWikipedia = resolvedClusters.map((r) => r.wiki);
  const sapRows = clusterSapRowsFromResolved(resolvedClusters);

  onClusterProgress?.(resolvedClusters.length, resolvedClusters.length, "", cumulativeSapRows);

  return {
    suggestedTargets,
    sapRows,
    wikiEntityPoolTitles: clusterWikipedia.map((w) => w.title),
    wikiMarkdown: buildWikiMarkdown(clusterWikipedia),
    bucketsUsed: resolvedClusters.map((r) => r.bucket),
    clusterWikipedia,
  };
}

export async function runEntityGridLocationClusterAgent(
  options: EntityGridLocationClusterOptions,
): Promise<EntityGridLocationClusterResult> {
  const { gridRows, entityTypeFocus, ...rest } = options;
  if (gridRows.length === 0) {
    throw new Error("Grid CSV has no rows for location clustering.");
  }
  const wantsNeighbourhoods = entityTypeFocusWantsNeighbourhoods(entityTypeFocus);
  const allBuckets = wantsNeighbourhoods
    ? buildCityLocationBucketsFromRows(gridRows)
    : buildGridLocationBucketsFromRows(gridRows);
  if (allBuckets.length === 0) {
    throw new Error("No grid location buckets found. Check Address column in the CSV.");
  }
  return runEntityLocationClusterFromBuckets({ ...rest, entityTypeFocus, buckets: allBuckets });
}
