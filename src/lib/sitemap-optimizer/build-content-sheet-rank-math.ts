import {
  fullDestinationUrl,
  normalizeRankMathRelativePath,
  rankMathSourceFromPageUrl,
  slugifyFocusKeywordToRelativePath,
} from "@/lib/rank-math-redirect-csv";
import { buildRankMathRedirectCsv } from "@/lib/rank-math-redirect-csv";
import { applyBlogDestinationPolicy } from "@/lib/sitemap-optimizer/blog-destination-policy";
import { buildContentSheetRows } from "@/lib/sitemap-optimizer/build-content-sheet-rows";
import { gridMemberSourceUrl } from "@/lib/sitemap-optimizer/grid-member-url";
import { buildGridPublishContracts } from "@/lib/sitemap-optimizer/build-grid-rank-math-redirects";
import {
  buildMergePublishContracts,
  type SitemapMergePublishContract,
} from "@/lib/sitemap-optimizer/sitemap-merge-publish-contract";
import type {
  SitemapOptimizerContentSheetRow,
  SitemapOptimizerRunResult,
} from "@/lib/sitemap-optimizer/types";

function csvEsc(s: string): string {
  return `"${String(s).replace(/"/g, '""')}"`;
}

export function proposedDestinationUrlForSheetRow(
  sheetRow: SitemapOptimizerContentSheetRow,
  contractByCluster: Map<string, SitemapMergePublishContract>,
  runMode?: SitemapOptimizerRunResult["runMode"],
  blogDestination?: SitemapOptimizerRunResult["blogDestination"],
): string {
  let raw: string;
  if (sheetRow.proposedDestinationUrl?.trim()) {
    raw = sheetRow.proposedDestinationUrl.trim();
  } else if (
    sheetRow.mergeClusterId &&
    (sheetRow.action === "merge" || sheetRow.action === "new_blog" || runMode === "grid_csv")
  ) {
    const contract = contractByCluster.get(sheetRow.mergeClusterId);
    raw = contract?.destinationUrl?.trim() ?? sheetRow.sourceUrl.trim();
  } else {
    const slugPath =
      slugifyFocusKeywordToRelativePath(sheetRow.proposedPrimaryKeyword) ??
      slugifyFocusKeywordToRelativePath(sheetRow.proposedTitle);
    const built = slugPath ? fullDestinationUrl(sheetRow.sourceUrl, slugPath) : null;
    raw = built ?? sheetRow.sourceUrl.trim();
  }
  return applyBlogDestinationPolicy(raw, blogDestination);
}

export function buildContentSheetRankMathRedirectRows(
  result: SitemapOptimizerRunResult,
): Array<{ source: string; destination: string; sourceUrl: string; destinationUrl: string }> {
  const sheet = result.contentSheet?.length
    ? result.contentSheet
    : buildContentSheetRows({
        rows: result.rows,
        clusters: result.clusters,
        merges: result.merges,
        blogDestination: result.blogDestination,
      });
  const contracts =
    result.runMode === "grid_csv"
      ? buildGridPublishContracts(result)
      : buildMergePublishContracts(result);
  const contractByCluster = new Map(contracts.map((c) => [c.clusterId, c]));
  const out: Array<{ source: string; destination: string; sourceUrl: string; destinationUrl: string }> =
    [];

  const rowByPostId = new Map(result.rows.map((r) => [r.postId, r]));

  for (const row of sheet) {
    const inventory = rowByPostId.get(row.postId);
    const legacyUrl =
      row.legacySourceUrl?.trim() ||
      (result.runMode === "grid_csv" && inventory
        ? gridMemberSourceUrl(inventory)
        : row.sourceUrl);
    const sourceRel = rankMathSourceFromPageUrl(legacyUrl);
    if (!sourceRel) continue;
    const destinationUrl = proposedDestinationUrlForSheetRow(
      row,
      contractByCluster,
      result.runMode,
      result.blogDestination,
    );
    const destRel = normalizeRankMathRelativePath(destinationUrl);
    if (!destRel) continue;

    let destFull = destinationUrl;
    try {
      const origin = new URL(row.sourceUrl.trim()).origin;
      destFull = `${origin}/${destRel}`;
    } catch {
      destFull = destinationUrl;
    }

    out.push({
      source: sourceRel,
      destination: destFull,
      sourceUrl: legacyUrl.trim(),
      destinationUrl: destFull,
    });
  }
  return out;
}

/** Rank Math import format for every content-sheet row (old path → new path). */
export function buildSitemapOptimizerContentSheetRankMathCsv(
  result: SitemapOptimizerRunResult,
): { csv: string; rowCount: number } {
  const rows = buildContentSheetRankMathRedirectRows(result);
  return {
    csv: buildRankMathRedirectCsv(rows.map((r) => ({ source: r.source, destination: r.destination }))),
    rowCount: rows.length,
  };
}

/** Wide CSV: full old/new URLs plus proposed title for every analyzed URL. */
export function buildSitemapOptimizerContentSheetRankMathWideCsv(
  result: SitemapOptimizerRunResult,
): string {
  const sheet = result.contentSheet?.length
    ? result.contentSheet
    : buildContentSheetRows({
        rows: result.rows,
        clusters: result.clusters,
        merges: result.merges,
        blogDestination: result.blogDestination,
      });
  const contracts =
    result.runMode === "grid_csv"
      ? buildGridPublishContracts(result)
      : buildMergePublishContracts(result);
  const contractByCluster = new Map(contracts.map((c) => [c.clusterId, c]));

  const header = [
    "action",
    "priority",
    "old_url",
    "new_url",
    "proposed_title",
    "proposed_keyword",
    "proposed_meta",
    "rank_math_source",
    "rank_math_destination",
  ];
  const lines = [header.join(",")];

  const rowByPostId = new Map(result.rows.map((r) => [r.postId, r]));

  for (const row of sheet) {
    const inventory = rowByPostId.get(row.postId);
    const oldUrl =
      row.legacySourceUrl?.trim() ||
      (result.runMode === "grid_csv" && inventory
        ? gridMemberSourceUrl(inventory)
        : row.sourceUrl);
    const sourceRel = rankMathSourceFromPageUrl(oldUrl) ?? "";
    const destUrl = proposedDestinationUrlForSheetRow(
      row,
      contractByCluster,
      result.runMode,
      result.blogDestination,
    );
    const destRel = normalizeRankMathRelativePath(destUrl) ?? "";
    lines.push(
      [
        row.action,
        row.priority,
        oldUrl,
        destUrl,
        row.proposedTitle,
        row.proposedPrimaryKeyword,
        row.proposedMeta,
        sourceRel,
        destRel,
      ]
        .map((c) => csvEsc(String(c ?? "")))
        .join(","),
    );
  }
  return lines.join("\n");
}
