import { useMemo } from "react";
import {
  displayPostTitle,
  sortMergesByPriority,
} from "@/lib/sitemap-optimizer/merge-results-display";
import {
  filterMergeableMerges,
  resolvedMemberRows,
} from "@/lib/sitemap-optimizer/resolved-cluster-members";
import { rowByPostIdMap } from "@/lib/sitemap-optimizer/sitemap-optimizer-export";
import type {
  SitemapOptimizerCluster,
  SitemapOptimizerMergeRecommendation,
  SitemapOptimizerPostRow,
} from "@/lib/sitemap-optimizer/types";
import { SitemapOptimizerMergeResultCard } from "@/components/research/sitemap-optimizer/SitemapOptimizerMergeResultCard";

type Props = {
  merges: SitemapOptimizerMergeRecommendation[];
  clusters: SitemapOptimizerCluster[];
  rows: SitemapOptimizerPostRow[];
};

function memberTitlesForMerge(
  merge: SitemapOptimizerMergeRecommendation,
  clusters: SitemapOptimizerCluster[],
  rowMap: Map<string, SitemapOptimizerPostRow>,
): { url: string; title: string }[] {
  const cluster = clusters.find((c) => c.clusterId === merge.clusterId);
  if (!cluster) return [];

  const fromRows = resolvedMemberRows(cluster, rowMap).map((r) => ({
    url: r.url,
    title: displayPostTitle(r.title),
  }));

  if (fromRows.length >= 2) return fromRows;

  const fallback = merge.whatToKeepFromEach
    .filter((k) => k.url.trim() || k.title.trim())
    .map((k) => ({
      url: k.url.trim(),
      title: displayPostTitle(k.title || k.url),
    }));

  return fallback.length >= 2 ? fallback : [];
}

export function SitemapOptimizerMergeResultsList({
  merges,
  clusters,
  rows,
}: Props) {
  const rowMap = useMemo(() => rowByPostIdMap(rows), [rows]);
  const sortedMerges = useMemo(
    () => sortMergesByPriority(filterMergeableMerges(merges, clusters, rows)),
    [merges, clusters, rows],
  );

  if (sortedMerges.length === 0) {
    return (
      <p className="text-base text-muted-foreground">No merge groups found for this run.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sortedMerges.map((merge) => {
        const sources = memberTitlesForMerge(merge, clusters, rowMap);
        return (
          <SitemapOptimizerMergeResultCard
            key={merge.clusterId}
            merge={merge}
            sources={sources}
          />
        );
      })}
    </div>
  );
}
