import {
  resolveContentSheetDestinationUrl,
  resolveContentSheetLegacySourceUrlForRow,
} from "@/lib/sitemap-optimizer/content-sheet-source-url";
import { buildDeterministicGridBrief } from "@/lib/sitemap-optimizer/grid-deterministic-brief";
import { buildMergeContentModifier } from "@/lib/sitemap-optimizer/merge-content-brief";
import { displayPostTitle } from "@/lib/sitemap-optimizer/merge-results-display";
import { blogDestinationPolicyForCollections } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { buildMergePublishContract } from "@/lib/sitemap-optimizer/sitemap-merge-publish-contract";
import {
  buildMergeGroupNumbersForGrid,
  buildMergeGroupNumberByClusterUploadOrder,
  mergeGroupNumberForCluster,
  mergeGroupNumberForDestination,
} from "@/lib/sitemap-optimizer/grid-merge-group-ids";
import type { GridMaxUrlsPerPost } from "@/lib/sitemap-optimizer/grid-macro-cluster-policy";
import { resolvedMemberRows } from "@/lib/sitemap-optimizer/resolved-cluster-members";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerClusterResult,
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";

function representativeGridMember(members: SitemapOptimizerPostRow[]): SitemapOptimizerPostRow {
  return [...members].sort(
    (a, b) => (a.uploadRowIndex ?? Number.MAX_SAFE_INTEGER) - (b.uploadRowIndex ?? Number.MAX_SAFE_INTEGER),
  )[0]!;
}

function aggregateGscMetric(
  members: readonly SitemapOptimizerPostRow[],
  pick: (row: SitemapOptimizerPostRow) => number | undefined,
): number | undefined {
  let sum = 0;
  let any = false;
  for (const m of members) {
    const v = pick(m);
    if (v != null && Number.isFinite(v)) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : undefined;
}

function buildContentSheetRowForCluster(args: {
  cluster: SitemapOptimizerCluster;
  rowMap: Map<string, SitemapOptimizerPostRow>;
  briefByClusterId: Map<string, SitemapOptimizerMergeRecommendation>;
  groupByDestination: Map<string, number> | null;
  groupByCluster: Map<string, number> | null;
  oneToOne: boolean;
  publishedAt: string;
  macroMode: boolean;
  blogDestination: ReturnType<typeof blogDestinationPolicyForCollections>;
}): SitemapOptimizerContentSheetRow {
  const {
    cluster,
    rowMap,
    briefByClusterId,
    groupByDestination,
    groupByCluster,
    oneToOne,
    publishedAt,
    macroMode,
    blogDestination,
  } = args;
  const members = resolvedMemberRows(cluster, rowMap);
  const rep = representativeGridMember(members);
  const brief =
    briefByClusterId.get(cluster.clusterId) ?? buildDeterministicGridBrief(cluster, rowMap);
  if (!brief) {
    throw new Error(`Missing new blog brief for cluster ${cluster.clusterId}`);
  }
  const contract = buildMergePublishContract(brief, members, publishedAt, {
    minMembers: 1,
    blogDestination,
  });
  const destinationUrl = resolveContentSheetDestinationUrl({
    row: rep,
    merge: brief,
    contract,
    blogDestination,
  });
  const mergeGroupNumber = oneToOne
    ? mergeGroupNumberForCluster(cluster.clusterId, groupByCluster!)
    : contract?.destinationUrl
      ? mergeGroupNumberForDestination(contract.destinationUrl, groupByDestination!)
      : undefined;

  return {
    postId: rep.postId,
    sourceUrl: destinationUrl,
    proposedDestinationUrl: destinationUrl,
    sourceTitle: "",
    action: "new_blog",
    priority: brief.priority,
    proposedTitle: displayPostTitle(brief.recommendedTitle),
    proposedPrimaryKeyword: brief.recommendedPrimaryKeyword.trim(),
    proposedMeta: brief.recommendedMeta.trim(),
    mergeClusterId: cluster.clusterId,
    mergeGroupNumber,
    mergeGroupLabel: cluster.label,
    rationale: brief.rationale,
    gscClicks: aggregateGscMetric(members, (m) => m.gscPageClicks),
    gscImpressions: aggregateGscMetric(members, (m) => m.gscPageImpressions),
    combinedOutline: brief.combinedOutline,
    modifier: buildMergeContentModifier(brief),
    whatToKeepFromEach: brief.whatToKeepFromEach,
    mergeSourceCount: members.length,
    uploadRowIndex: rep.uploadRowIndex,
    isSingletonCluster: macroMode ? false : members.length < 2,
    gridTopicTag: rep.gridTopicTag,
    gridGeoTag: rep.gridGeoTag,
    gridTagLabel: rep.gridTagLabel,
    legacySourceUrl: resolveContentSheetLegacySourceUrlForRow(rep, destinationUrl),
  };
}

export function buildContentSheetRowsGrid(args: {
  rows: SitemapOptimizerPostRow[];
  clusters: SitemapOptimizerClusterResult;
  merges: SitemapOptimizerMergeRecommendation[];
  macroMode?: boolean;
  gridMaxUrlsPerPost?: GridMaxUrlsPerPost;
}): SitemapOptimizerContentSheetRow[] {
  const { rows, clusters, merges, macroMode = false, gridMaxUrlsPerPost } = args;
  const rowMap = new Map(rows.map((r) => [r.postId, r]));
  const briefByClusterId = new Map(merges.map((m) => [m.clusterId, m]));
  const oneToOne = gridMaxUrlsPerPost === 1;
  const groupByDestination = oneToOne
    ? null
    : buildMergeGroupNumbersForGrid({ rows, clusters, merges });
  const groupByCluster = oneToOne
    ? buildMergeGroupNumberByClusterUploadOrder(clusters, rows)
    : null;
  const publishedAt = new Date().toISOString();
  const blogDestination = blogDestinationPolicyForCollections(new Set(["posts"]), {
    gridCsv: true,
  });

  return clusters.clusters.map((cluster) =>
    buildContentSheetRowForCluster({
      cluster,
      rowMap,
      briefByClusterId,
      groupByDestination,
      groupByCluster,
      oneToOne,
      publishedAt,
      macroMode,
      blogDestination,
    }),
  );
}

export function gridHarnessSummaryCounts(
  sheet: SitemapOptimizerContentSheetRow[],
  clusters: SitemapOptimizerClusterResult,
  maxUrlsPerPost?: number,
  uploadRowCount?: number,
): {
  uploadRows: number;
  newPostGroups: number;
  destinations: number;
  maxUrlsPerPost: number;
} {
  return {
    uploadRows: uploadRowCount ?? sheet.length,
    newPostGroups: clusters.clusters.length,
    destinations: clusters.clusters.length,
    maxUrlsPerPost: maxUrlsPerPost ?? 5,
  };
}
