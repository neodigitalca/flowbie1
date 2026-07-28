import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import {
  buildDomainOrganicCsvFromKeywordRows,
  DOMAIN_ORGANIC_CSV_TOP_ROWS,
} from "@/lib/competitor-research/competitor-domain-organic-csv";
import { sortKeywordsByTrafficThenVolume } from "@/lib/competitor-research/competitor-keyword-sort";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import type {
  CompetitorKeywordRow,
  CompetitorResearchSemrushResponse,
  GscSiteQueryRow,
} from "@/lib/competitor-research/types";

/**
 * True when seed + each competitor in `reportDomainKeys` already has semantic cluster rows
 * (`clusterMembers` on every keyword row). Raw Semrush rows omit `clusterMembers`.
 */
export function isSemrushClusteredForReportDomains(
  semrush: CompetitorResearchSemrushResponse,
  reportDomainKeys: Set<string>,
): boolean {
  const seed = semrush.seedTopKeywords ?? [];
  if (seed.length === 0) return false;
  if (!seed.every((r) => Array.isArray(r.clusterMembers))) return false;

  for (const row of semrush.rows ?? []) {
    const nk = normalizeCompetitorDomainKey(row.domain);
    if (!reportDomainKeys.has(nk)) continue;
    const kw = semrush.enrichmentByDomain?.[nk]?.topKeywords ?? [];
    if (kw.length === 0) continue;
    if (!kw.every((r) => Array.isArray(r.clusterMembers))) return false;
  }
  return true;
}

const SINGLE_CALL_MAX_CHARS = 52_000;

/** Max concurrent OpenRouter clustering calls when the payload is split per competitor. */
const CLUSTER_SPLIT_COMPETITOR_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  const ret: R[] = new Array(n);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = next++;
      if (idx >= n) return;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

/** Max semantic clusters per domain (seed + each competitor list). */
export const MAX_SEMANTIC_CLUSTERS = 25;

function normalizePhraseKey(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Merge rows that share the same normalized phrase so each exact `phrase` is unique.
 * Sums volume/traffic; position is best (lowest). Model output is then aligned via
 * `repairClustersToCanonicalPartition` (fuzzy match to these phrases).
 */
export function dedupeKeywordRowsForClustering(rows: CompetitorKeywordRow[]): CompetitorKeywordRow[] {
  type Acc = {
    phrase: string;
    volumeSum: number;
    volumeAny: boolean;
    trafficSum: number;
    trafficAny: boolean;
    positions: number[];
  };
  const byKey = new Map<string, Acc>();
  for (const r of rows) {
    const k = normalizePhraseKey(r.phrase);
    if (!k) continue;
    if (!byKey.has(k)) {
      byKey.set(k, {
        phrase: r.phrase.trim(),
        volumeSum: 0,
        volumeAny: false,
        trafficSum: 0,
        trafficAny: false,
        positions: [],
      });
    }
    const acc = byKey.get(k)!;
    if (r.volume != null && Number.isFinite(r.volume)) {
      acc.volumeSum += r.volume;
      acc.volumeAny = true;
    }
    if (r.traffic != null && Number.isFinite(r.traffic)) {
      acc.trafficSum += r.traffic;
      acc.trafficAny = true;
    }
    if (r.position != null && Number.isFinite(r.position)) {
      acc.positions.push(r.position);
    }
  }
  const merged: CompetitorKeywordRow[] = [];
  for (const acc of byKey.values()) {
    merged.push({
      phrase: acc.phrase,
      volume: acc.volumeAny ? acc.volumeSum : null,
      traffic: acc.trafficAny ? acc.trafficSum : null,
      position: acc.positions.length > 0 ? Math.min(...acc.positions) : null,
    });
  }
  return sortKeywordsByTrafficThenVolume(merged);
}

function rowByPhraseMap(rows: CompetitorKeywordRow[]): Map<string, CompetitorKeywordRow> {
  const m = new Map<string, CompetitorKeywordRow>();
  for (const r of rows) {
    const k = normalizePhraseKey(r.phrase);
    if (!k) continue;
    if (!m.has(k)) m.set(k, r);
  }
  return m;
}

/** Build multiset pools: exact phrase string -> stack of rows (consumes duplicates). */
function buildPhrasePools(rows: CompetitorKeywordRow[]): Map<string, CompetitorKeywordRow[]> {
  const m = new Map<string, CompetitorKeywordRow[]>();
  for (const r of rows) {
    const p = r.phrase;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(r);
  }
  return m;
}

export type RawSemanticCluster = { label: string; members: string[] };

/** Levenshtein distance on Unicode code units (fine for short keyword phrases). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n]!;
}

function phraseMatchScore(modelMember: string, canonicalPhrase: string): number {
  const a = normalizePhraseKey(modelMember);
  const b = normalizePhraseKey(canonicalPhrase);
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  return levenshtein(a, b);
}

/**
 * Prefer normalized exact match; else smallest Levenshtein if within a loose cap (typos/spacing).
 * Returns -1 when no safe match (phrase stays in pool for a singleton cluster).
 */
function pickBestPoolIndexForModelMember(modelMember: string, pool: string[]): number {
  if (pool.length === 0) return -1;
  const nm = normalizePhraseKey(modelMember);
  for (let i = 0; i < pool.length; i++) {
    if (normalizePhraseKey(pool[i]!) === nm) return i;
  }
  let bestIdx = -1;
  let best = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const s = phraseMatchScore(modelMember, pool[i]!);
    if (s < best) {
      best = s;
      bestIdx = i;
    }
  }
  if (bestIdx < 0) return -1;
  const pk = normalizePhraseKey(pool[bestIdx]!);
  const cap = Math.max(2, Math.floor(Math.max(nm.length, pk.length, 1) * 0.35));
  return best <= cap ? bestIdx : -1;
}

/**
 * Maps model cluster members to canonical INPUT phrases (fuzzy), consumes each input phrase at most once,
 * adds missing phrases as singleton clusters, drops extra model members when pool is exhausted,
 * merges down to MAX_SEMANTIC_CLUSTERS if needed. Does not throw for count/spelling drift.
 */
/** Exported for unit tests; maps model output to canonical INPUT phrases without throwing. */
export function repairClustersToCanonicalPartition(
  clusters: RawSemanticCluster[] | undefined,
  inputRows: CompetitorKeywordRow[],
): RawSemanticCluster[] {
  if (inputRows.length === 0) {
    return [];
  }
  const pool: string[] = inputRows.map((r) => r.phrase);
  const repaired: RawSemanticCluster[] = [];

  if (clusters && Array.isArray(clusters)) {
    for (const c of clusters) {
      if (!c || typeof c.label !== "string" || !Array.isArray(c.members)) continue;
      const label = c.label.trim() || "Cluster";
      const members: string[] = [];
      const seenNorm = new Set<string>();
      for (const m of c.members) {
        if (typeof m !== "string" || pool.length === 0) continue;
        const mn = normalizePhraseKey(m);
        if (mn && seenNorm.has(mn)) continue;
        const idx = pickBestPoolIndexForModelMember(m, pool);
        if (idx < 0) continue;
        const picked = pool[idx]!;
        seenNorm.add(normalizePhraseKey(picked));
        members.push(picked);
        pool.splice(idx, 1);
      }
      if (members.length > 0) {
        repaired.push({ label, members });
      }
    }
  }

  for (const p of pool) {
    const t = p.trim();
    repaired.push({ label: t || "Keyword", members: [p] });
  }

  if (repaired.length > MAX_SEMANTIC_CLUSTERS) {
    return mergeClustersDownToMax(repaired, MAX_SEMANTIC_CLUSTERS);
  }
  return repaired;
}

function mergeClustersDownToMax(clusters: RawSemanticCluster[], max: number): RawSemanticCluster[] {
  if (clusters.length <= max) return clusters;
  const c = clusters.map((x) => ({ label: x.label.trim(), members: [...x.members] }));
  while (c.length > max) {
    const last = c.pop()!;
    const prev = c.pop()!;
    c.push({
      label: `${prev.label} · ${last.label}`.slice(0, 220),
      members: [...prev.members, ...last.members],
    });
  }
  return c;
}

function aggregateCluster(label: string, members: string[], pools: Map<string, CompetitorKeywordRow[]>): CompetitorKeywordRow {
  let volSum = 0;
  let trSum = 0;
  let volAny = false;
  let trAny = false;
  const positions: number[] = [];
  const take = new Map<string, number>();

  for (const m of members) {
    const stack = pools.get(m);
    const idx = take.get(m) ?? 0;
    if (!stack || idx >= stack.length) {
      throw new Error(`Keyword clustering: internal pool miss for phrase "${m}".`);
    }
    take.set(m, idx + 1);
    const row = stack[idx]!;
    if (row.volume != null && Number.isFinite(row.volume)) {
      volSum += row.volume;
      volAny = true;
    }
    if (row.traffic != null && Number.isFinite(row.traffic)) {
      trSum += row.traffic;
      trAny = true;
    }
    if (row.position != null && Number.isFinite(row.position)) {
      positions.push(row.position);
    }
  }

  const bestPos = positions.length > 0 ? Math.min(...positions) : null;

  return {
    phrase: label.trim(),
    volume: volAny ? volSum : null,
    traffic: trAny ? trSum : null,
    position: bestPos,
    clusterMembers: members.slice(),
  };
}

function clustersToRows(clusters: RawSemanticCluster[], inputRows: CompetitorKeywordRow[]): CompetitorKeywordRow[] {
  const repaired = repairClustersToCanonicalPartition(clusters, inputRows);
  const pools = buildPhrasePools(inputRows);
  return repaired.map((c) => aggregateCluster(c.label.trim(), c.members, pools));
}

const CLUSTER_SYSTEM_BASE = `You group organic search keywords into semantic clusters (same topic / intent). Return JSON only, no markdown, no code fences.

RULES:
- At most ${MAX_SEMANTIC_CLUSTERS} clusters per list (seed list, or each competitor domain list).
- Each INPUT phrase must appear in exactly ONE cluster as a member string. Match INPUT phrases closely (same words; minor spacing or casing differences are OK).
- For each cluster output: "label" (short readable name, e.g. "Invisalign Edmonton") and "members" (array of those phrases from INPUT).
- Do not invent wholly new phrases that are not in INPUT. Do not output volume, traffic, or position (metrics are computed separately).

OUTPUT SHAPE (exact top-level keys):
{"seed":[{"label":"string","members":["phrase1",...]}],"competitors":{"example.com":[{"label":"...","members":[...]}]}}
Use empty array for seed if seed input was empty. Use competitor domain keys exactly as in INPUT_JSON.`;

export const MAX_CLUSTER_EXCLUDE_PHRASES = 100;

export function buildClusterExcludePhrases(
  gscSiteQueries: GscSiteQueryRow[],
  seedPhrasesForExclude: string[],
): string[] {
  const fromGsc = [...gscSiteQueries]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 80)
    .map((q) => q.query.trim())
    .filter(Boolean);
  const fromSeed = seedPhrasesForExclude.slice(0, 20).map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...fromGsc, ...fromSeed]) {
    const k = normalizePhraseKey(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= MAX_CLUSTER_EXCLUDE_PHRASES) break;
  }
  return out;
}

function buildClusterSystem(excludePhrases: string[]): string {
  if (excludePhrases.length === 0) return CLUSTER_SYSTEM_BASE;
  const ex = JSON.stringify(excludePhrases.slice(0, MAX_CLUSTER_EXCLUDE_PHRASES));
  return `${CLUSTER_SYSTEM_BASE}

COVERAGE_TO_AVOID (GSC queries plus seed phrases the site already earns; JSON string array):
${ex}
When non-empty, prefer cluster labels that emphasize net-new intent vs these strings (members must still correspond to INPUT phrases).`;
}

function normalizeCompetitorsInput(
  competitors: Record<string, CompetitorKeywordRow[]>,
): Record<string, CompetitorKeywordRow[]> {
  const out: Record<string, CompetitorKeywordRow[]> = {};
  for (const [d, rows] of Object.entries(competitors)) {
    out[normalizeCompetitorDomainKey(d)] = rows;
  }
  return out;
}

export type ParsedClusterResponse = {
  seed?: RawSemanticCluster[];
  competitors?: Record<string, RawSemanticCluster[]>;
};

async function fetchClusterKeywordCompletion(
  apiKey: string,
  model: string,
  system: string,
  userPayload: { seed: CompetitorKeywordRow[]; competitors: Record<string, CompetitorKeywordRow[]> },
  signal: AbortSignal | undefined,
): Promise<{
  content: string;
  finishReason?: string;
  nativeFinishReason?: string;
}> {
  const userStr = `INPUT_JSON:\n${JSON.stringify(userPayload)}`;
  const maxTok = getCompetitorReportMaxOutputTokens(model);
  return callOpenRouterChatCompletion({
    apiKey,
    model,
    system,
    user: userStr,
    maxTokens: maxTok,
    signal,
  });
}

async function callClusterModelRaw(
  apiKey: string,
  model: string,
  system: string,
  userPayload: { seed: CompetitorKeywordRow[]; competitors: Record<string, CompetitorKeywordRow[]> },
  signal: AbortSignal | undefined,
): Promise<ParsedClusterResponse> {
  const { content } = await fetchClusterKeywordCompletion(apiKey, model, system, userPayload, signal);
  try {
    return parseAssistantJsonObject(content) as ParsedClusterResponse;
  } catch (e1) {
    const msg = e1 instanceof Error ? e1.message : String(e1);
    const { content: content2 } = await fetchClusterKeywordCompletion(
      apiKey,
      model,
      `${system}\n\nCRITICAL: Your previous output was not valid JSON. Return one JSON object only: no markdown fences, no trailing commas, and a comma between every array element (including in "members"). Use only double-quoted strings.`,
      userPayload,
      signal,
    );
    try {
      return parseAssistantJsonObject(content2) as ParsedClusterResponse;
    } catch {
      throw new Error(`Keyword clustering: failed to parse JSON from model. ${msg}`);
    }
  }
}

function parseClustersOrThrow(parsed: ParsedClusterResponse, label: string): RawSemanticCluster[] {
  const arr = parsed.seed ?? parsed.competitors?.[label];
  if (!Array.isArray(arr)) {
    throw new Error(`Keyword clustering (${label}): missing cluster array in model response.`);
  }
  return arr as RawSemanticCluster[];
}

/**
 * Semantic clusters via OpenRouter: model assigns labels + member phrases; metrics aggregated in code.
 * Member lists are aligned to INPUT phrases with fuzzy matching (no strict partition errors).
 */
export async function clusterReportKeywordsAggregated(args: {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  seed: CompetitorKeywordRow[];
  competitors: Record<string, CompetitorKeywordRow[]>;
  excludePhrases?: string[];
}): Promise<{ seed: CompetitorKeywordRow[]; competitors: Record<string, CompetitorKeywordRow[]> }> {
  const competitorsIn = normalizeCompetitorsInput(args.competitors);
  const competitorsDeduped: Record<string, CompetitorKeywordRow[]> = {};
  for (const [k, rows] of Object.entries(competitorsIn)) {
    competitorsDeduped[k] = dedupeKeywordRowsForClustering(rows);
  }
  const seed = dedupeKeywordRowsForClustering(args.seed);
  const excludePhrases = args.excludePhrases ?? [];

  const fullPayload = { seed, competitors: competitorsDeduped };
  const userStr = `INPUT_JSON:\n${JSON.stringify(fullPayload)}`;

  if (userStr.length > SINGLE_CALL_MAX_CHARS) {
    return clusterSplitBatched({
      apiKey: args.apiKey,
      model: args.model,
      signal: args.signal,
      seed,
      competitors: competitorsDeduped,
      excludePhrases,
    });
  }

  const parsed = await callClusterModelRaw(
    args.apiKey,
    args.model,
    buildClusterSystem(excludePhrases),
    fullPayload,
    args.signal,
  );

  return mergeParsedClustersIntoRows(parsed, seed, competitorsDeduped);
}

async function clusterSplitBatched(args: {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  seed: CompetitorKeywordRow[];
  competitors: Record<string, CompetitorKeywordRow[]>;
  excludePhrases: string[];
}): Promise<{ seed: CompetitorKeywordRow[]; competitors: Record<string, CompetitorKeywordRow[]> }> {
  const sys = buildClusterSystem(args.excludePhrases);
  let seedOut: CompetitorKeywordRow[] = [];
  if (args.seed.length > 0) {
    const parsed = await callClusterModelRaw(
      args.apiKey,
      args.model,
      sys,
      { seed: args.seed, competitors: {} },
      args.signal,
    );
    const raw = parseClustersOrThrow(parsed, "seed");
    seedOut = clustersToRows(raw, args.seed);
  }

  const competitorsVal: Record<string, CompetitorKeywordRow[]> = {};
  const competitorEntries = Object.entries(args.competitors);
  for (const [nk, rows] of competitorEntries) {
    if (rows.length === 0) {
      competitorsVal[nk] = [];
    }
  }
  const toCluster = competitorEntries.filter(([, rows]) => rows.length > 0) as [string, CompetitorKeywordRow[]][];
  const clustered = await mapWithConcurrency(
    toCluster,
    CLUSTER_SPLIT_COMPETITOR_CONCURRENCY,
    async ([nk, rows]) => {
      const parsed = await callClusterModelRaw(
        args.apiKey,
        args.model,
        sys,
        { seed: [], competitors: { [nk]: rows } },
        args.signal,
      );
      const raw = parsed.competitors?.[nk];
      if (!Array.isArray(raw)) {
        throw new Error(`Keyword clustering (${nk}): missing competitors["${nk}"] in batched response.`);
      }
      return [nk, clustersToRows(raw as RawSemanticCluster[], rows)] as const;
    },
  );
  for (const [nk, rowsOut] of clustered) {
    competitorsVal[nk] = rowsOut;
  }

  return { seed: seedOut, competitors: competitorsVal };
}

function mergeParsedClustersIntoRows(
  parsed: ParsedClusterResponse,
  seedIn: CompetitorKeywordRow[],
  competitorsIn: Record<string, CompetitorKeywordRow[]>,
): { seed: CompetitorKeywordRow[]; competitors: Record<string, CompetitorKeywordRow[]> } {
  let seedOut: CompetitorKeywordRow[] = [];
  if (seedIn.length > 0) {
    const raw = parsed.seed;
    if (!Array.isArray(raw)) {
      throw new Error("Keyword clustering: model response missing seed array.");
    }
    seedOut = clustersToRows(raw as RawSemanticCluster[], seedIn);
  }

  const competitorsVal: Record<string, CompetitorKeywordRow[]> = {};
  for (const [nk, rows] of Object.entries(competitorsIn)) {
    if (rows.length === 0) {
      competitorsVal[nk] = [];
      continue;
    }
    const raw = parsed.competitors?.[nk];
    if (!Array.isArray(raw)) {
      throw new Error(`Keyword clustering: model response missing competitors["${nk}"].`);
    }
    competitorsVal[nk] = clustersToRows(raw as RawSemanticCluster[], rows);
  }

  return { seed: seedOut, competitors: competitorsVal };
}

/**
 * Applies semantic-cluster rows (label + aggregated Σ Vol/Σ Tr/best pos + clusterMembers) to Semrush for wire and CSV.
 */
export function applyClusteredKeywordsToSemrush(
  semrush: CompetitorResearchSemrushResponse,
  result: { seed: CompetitorKeywordRow[]; competitors: Record<string, CompetitorKeywordRow[]> },
  reportDomainKeys: Set<string>,
): CompetitorResearchSemrushResponse {
  const seedTopKeywords = result.seed;
  const seedDomainOrganicCsv = buildDomainOrganicCsvFromKeywordRows(seedTopKeywords, DOMAIN_ORGANIC_CSV_TOP_ROWS);

  const domainOrganicCsvByDomain: Record<string, string> = { ...(semrush.domainOrganicCsvByDomain ?? {}) };
  const enrichmentByDomain = { ...(semrush.enrichmentByDomain ?? {}) };

  for (const [d, rows] of Object.entries(result.competitors)) {
    const nk = normalizeCompetitorDomainKey(d);
    if (!reportDomainKeys.has(nk)) continue;
    domainOrganicCsvByDomain[nk] = buildDomainOrganicCsvFromKeywordRows(rows, DOMAIN_ORGANIC_CSV_TOP_ROWS);
    const prev = enrichmentByDomain[nk] ?? { topKeywords: [] };
    enrichmentByDomain[nk] = { ...prev, topKeywords: rows };
  }

  return {
    ...semrush,
    seedTopKeywords,
    seedDomainOrganicCsv,
    domainOrganicCsvByDomain,
    enrichmentByDomain,
  };
}

/** @deprecated Legacy one-row-per-cluster validator; kept for tests that import it. */
export function validateClusterPicksAgainstInput(
  picks: CompetitorKeywordRow[] | undefined,
  allowed: CompetitorKeywordRow[],
  max: number,
): CompetitorKeywordRow[] {
  const map = rowByPhraseMap(allowed);
  const out: CompetitorKeywordRow[] = [];
  const seen = new Set<string>();
  for (const row of picks ?? []) {
    const k = normalizePhraseKey(row.phrase);
    if (!k || seen.has(k)) continue;
    const canon = map.get(k);
    if (!canon) continue;
    seen.add(k);
    out.push(canon);
    if (out.length >= max) break;
  }
  return out;
}

/** Back-compat alias */
export const clusterReportKeywordsOrFallback = clusterReportKeywordsAggregated;
