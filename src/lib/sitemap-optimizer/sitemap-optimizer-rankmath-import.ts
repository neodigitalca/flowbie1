import Papa from "papaparse";
import {
  normalizeRankMathRelativePath,
  normalizedPageUrlForCompare,
  rankMathSourceFromPageUrl,
} from "@/lib/rank-math-redirect-csv";
import { buildContentSheetRows } from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import { SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE } from "@/lib/sitemap-optimizer/constants";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerGscDateRange,
  SitemapOptimizerPostRow,
  SitemapOptimizerRunResult,
} from "@/lib/sitemap-optimizer/types";

export type RankMathRedirectRow = {
  source: string;
  destination: string;
};

export type RankMathDestinationGroup = {
  destKey: string;
  destinationUrl: string;
  sources: string[];
};

export type MatchSourcesResult = {
  groups: Array<{
    destKey: string;
    destinationUrl: string;
    memberRows: SitemapOptimizerPostRow[];
    unmatchedSources: string[];
  }>;
  unmatchedSources: string[];
  tooFewMembers: string[];
};

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "");
}

function pickColumn(row: Record<string, unknown>, names: string[]): string {
  const keys = Object.keys(row);
  for (const name of names) {
    const norm = normalizeHeaderKey(name);
    for (const k of keys) {
      if (normalizeHeaderKey(k) === norm) {
        const v = row[k];
        if (v != null && String(v).trim()) return String(v).trim();
      }
    }
  }
  return "";
}

function isActiveStatus(row: Record<string, unknown>): boolean {
  const status = pickColumn(row, ["status"]);
  if (!status) return true;
  return status.toLowerCase() === "active";
}

function relativePathKey(path: string): string | null {
  return normalizeRankMathRelativePath(path);
}

function destinationPathKey(destination: string): string | null {
  const trimmed = destination.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      let path = new URL(trimmed).pathname.replace(/^\/+/, "").toLowerCase().replace(/\/+/g, "/");
      if (!path.endsWith("/")) path += "/";
      return path;
    } catch {
      return null;
    }
  }
  return relativePathKey(trimmed);
}

function sourceEqualsDestination(source: string, destination: string): boolean {
  const src = relativePathKey(source);
  const dest = destinationPathKey(destination);
  if (!src || !dest) return false;
  return src === dest;
}

/** Stable group key for destination column (full URL or relative path). */
export function destinationGroupKey(destination: string): string | null {
  const full = normalizedPageUrlForCompare(destination);
  if (full) return full;
  const rel = relativePathKey(destination);
  if (rel) return `path:${rel}`;
  return null;
}

/** Canonical destination URL for contracts (full URL from sheet, or resolved with site origin). */
export function resolveDestinationUrl(destination: string, siteOrigin: string): string | null {
  const trimmed = destination.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      let path = u.pathname.replace(/\/+/g, "/");
      if (!path.endsWith("/")) path += "/";
      return `${u.origin}${path}`;
    } catch {
      return null;
    }
  }
  const rel = normalizeRankMathRelativePath(trimmed);
  if (!rel) return null;
  const origin = siteOrigin.replace(/\/+$/, "");
  return `${origin}/${rel}`.replace(/([^:]\/)\/+/g, "$1");
}

/** Parse Rank Math redirect import CSV text. */
export function parseRankMathRedirectCsv(csvText: string): {
  rows: RankMathRedirectRow[];
  error?: string;
} {
  const trimmed = csvText.trim();
  if (!trimmed) return { rows: [], error: "CSV is empty." };

  const parsed = Papa.parse<Record<string, unknown>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const msg = parsed.errors.map((e) => e.message).join("; ");
    return { rows: [], error: msg || "Failed to parse CSV." };
  }

  const out: RankMathRedirectRow[] = [];
  for (const row of parsed.data) {
    if (!row || typeof row !== "object") continue;
    if (!isActiveStatus(row)) continue;

    const sourceRaw = pickColumn(row, ["source"]);
    const destRaw = pickColumn(row, ["destination"]);
    if (!sourceRaw || !destRaw) continue;

    const source = normalizeRankMathRelativePath(sourceRaw);
    if (!source) continue;

    const destination = destRaw.trim();
    if (!destinationPathKey(destination)) continue;
    if (sourceEqualsDestination(source, destination)) continue;

    out.push({ source, destination });
  }

  if (out.length === 0) {
    return { rows: [], error: "No valid source/destination redirect rows found." };
  }

  return { rows: out };
}

/** Group redirect rows by normalized destination URL. */
export function groupRedirectsByDestination(
  rows: RankMathRedirectRow[],
): RankMathDestinationGroup[] {
  const map = new Map<string, RankMathDestinationGroup>();

  for (const row of rows) {
    const destKey = destinationGroupKey(row.destination);
    if (!destKey) continue;

    let group = map.get(destKey);
    if (!group) {
      group = {
        destKey,
        destinationUrl: row.destination,
        sources: [],
      };
      map.set(destKey, group);
    }
    if (!group.sources.includes(row.source)) {
      group.sources.push(row.source);
    }
  }

  return [...map.values()];
}

function inventorySourceKey(row: SitemapOptimizerPostRow): string | null {
  return rankMathSourceFromPageUrl(row.url);
}

/** Match Rank Math source paths to inventory rows. */
export function matchSourcesToInventory(
  groups: RankMathDestinationGroup[],
  inventory: SitemapOptimizerPostRow[],
): MatchSourcesResult {
  const bySource = new Map<string, SitemapOptimizerPostRow[]>();
  for (const row of inventory) {
    const key = inventorySourceKey(row);
    if (!key) continue;
    const list = bySource.get(key) ?? [];
    list.push(row);
    bySource.set(key, list);
  }

  const unmatchedSources: string[] = [];
  const tooFewMembers: string[] = [];
  const matchedGroups: MatchSourcesResult["groups"] = [];

  for (const group of groups) {
    const memberRows: SitemapOptimizerPostRow[] = [];
    const groupUnmatched: string[] = [];
    const seenIds = new Set<string>();

    for (const source of group.sources) {
      const norm = normalizeRankMathRelativePath(source);
      if (!norm) {
        groupUnmatched.push(source);
        continue;
      }
      const hits = bySource.get(norm);
      if (!hits?.length) {
        groupUnmatched.push(source);
        unmatchedSources.push(source);
        continue;
      }
      for (const row of hits) {
        if (seenIds.has(row.postId)) continue;
        seenIds.add(row.postId);
        memberRows.push(row);
      }
    }

    if (memberRows.length < SITEMAP_OPTIMIZER_MIN_MERGE_GROUP_SIZE) {
      tooFewMembers.push(group.destinationUrl);
      for (const s of groupUnmatched) {
        if (!unmatchedSources.includes(s)) unmatchedSources.push(s);
      }
      continue;
    }

    matchedGroups.push({
      destKey: group.destKey,
      destinationUrl: group.destinationUrl,
      memberRows,
      unmatchedSources: groupUnmatched,
    });
  }

  return { unmatchedSources, tooFewMembers, groups: matchedGroups };
}

export function buildClustersFromRankMathGroups(
  matched: MatchSourcesResult["groups"],
): SitemapOptimizerCluster[] {
  return matched.map((g) => ({
    clusterId: `rankmath:${g.destKey}`,
    label: "Rank Math merge",
    intent: "consolidation",
    memberPostIds: g.memberRows.map((r) => r.postId),
    confidence: "high" as const,
    rationale: `Redirect plan: ${g.memberRows.length} source(s) to ${g.destinationUrl}`,
  }));
}

export function resolveMatchedGroupDestinations(groups: MatchSourcesResult["groups"]): void {
  for (const g of groups) {
    const firstUrl = g.memberRows[0]?.url?.trim();
    if (!firstUrl) continue;
    try {
      const origin = new URL(firstUrl).origin;
      const resolved = resolveDestinationUrl(g.destinationUrl, origin);
      if (resolved) g.destinationUrl = resolved;
    } catch {
      /* keep sheet value */
    }
  }
}

export function lockedDestinationsByClusterId(
  matched: MatchSourcesResult["groups"],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of matched) {
    m.set(`rankmath:${g.destKey}`, g.destinationUrl);
  }
  return m;
}

export function buildSingletonsFromInventory(
  inventory: SitemapOptimizerPostRow[],
  matchedMemberIds: Set<string>,
): string[] {
  return inventory
    .filter((r) => !matchedMemberIds.has(r.postId))
    .map((r) => r.postId);
}

export function assembleRankMathRunResult(args: {
  inventory: SitemapOptimizerPostRow[];
  matched: MatchSourcesResult["groups"];
  clusters: SitemapOptimizerCluster[];
  merges: import("@/lib/sitemap-optimizer/types").SitemapOptimizerMergeRecommendation[];
  dateRange: SitemapOptimizerGscDateRange;
  gscMissCount?: number;
}): SitemapOptimizerRunResult {
  const matchedIds = new Set<string>();
  for (const g of args.matched) {
    for (const r of g.memberRows) matchedIds.add(r.postId);
  }

  const rows = args.inventory.filter((r) => matchedIds.has(r.postId));
  const clusterResult: SitemapOptimizerClusterResult = {
    clusters: args.clusters,
    singletons: buildSingletonsFromInventory(args.inventory, matchedIds),
  };

  return {
    rows,
    clusters: clusterResult,
    merges: args.merges,
    contentSheet: buildContentSheetRows({
      rows,
      clusters: clusterResult,
      merges: args.merges,
    }),
    gscMissCount: args.gscMissCount ?? 0,
    dateRange: args.dateRange,
    analyzedAt: new Date().toISOString(),
  };
}

/** Fatal only — used when no merge groups could be built. 1:1 redirect rows are not errors. */
export function formatRankMathImportErrors(match: MatchSourcesResult): string | null {
  if (match.groups.length > 0) return null;
  if (match.unmatchedSources.length > 0) {
    const sample = match.unmatchedSources.slice(0, 5).join(", ");
    const more =
      match.unmatchedSources.length > 5
        ? ` (+${match.unmatchedSources.length - 5} more)`
        : "";
    return `No redirect rows matched WordPress inventory. Unmatched sources: ${sample}${more}`;
  }
  return "No merge groups with at least two matched source posts.";
}
