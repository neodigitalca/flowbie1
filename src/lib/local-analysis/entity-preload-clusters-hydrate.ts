import type { WordPressSite } from "@/components/integrations/types";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { GscSiteQueryRow } from "@/lib/competitor-research/types";
import {
  buildEntityTitleClusterJobsFromTargets,
  type EntityTitleClusterKeywordTarget,
} from "@/lib/local-analysis/entity-sap-title-cluster-jobs";
import {
  applyGridClusterWikipediaToSapRows,
  type GridClusterWikipedia,
} from "@/lib/local-analysis/entity-grid-location-wiki-agent";
import { hydrateEntityClusterSapRows } from "@/lib/local-analysis/entity-preview-sap-hydrate";
import {
  fillEntitySapRowKeywordsFromInventoryAndGsc,
  type EntitySapKeywordSources,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import {
  ensureEntitySiteWarmCache,
  gscQueriesFromWarmBundleForSapBudget,
} from "@/lib/local-analysis/entity-site-warm-cache";
import {
  buildEntityAdGroupSections,
  finalizeEntitySapRowsForAdGroups,
} from "@/lib/local-analysis/sap-entity-ad-groups";

export type PreloadClusterKeywordTarget = {
  id: string;
  keyword: string;
  entityHint: string;
  sapPages: number;
  clusterId?: string;
  clusterRole?: "seed" | "member";
};

export function keywordTargetsFromPreloadedSapRows(
  rows: CSVRow[],
  createId: () => string,
): PreloadClusterKeywordTarget[] {
  const sections = buildEntityAdGroupSections(rows);
  return sections.map((section) => ({
    id: createId(),
    keyword: "",
    entityHint: section.entity,
    sapPages: section.rowIndices.length,
    clusterId: section.groupId,
    clusterRole: "seed" as const,
  }));
}

export function preloadTargetsToTitleTargets(
  rows: PreloadClusterKeywordTarget[],
): EntityTitleClusterKeywordTarget[] {
  return rows.map((t) => ({
    id: t.id,
    keyword: t.keyword,
    entityHint: t.entityHint,
    sapPages: t.sapPages,
    ...(t.clusterId ? { clusterId: t.clusterId } : {}),
    ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
  }));
}

export function countBlankEntityKeywordRows(rows: readonly CSVRow[]): number {
  return rows.filter((r) => r.entity?.trim() && !r.keyword?.trim()).length;
}

export type FillEntitySlotKeywordsFromGscArgs = {
  site: WordPressSite;
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  rows: CSVRow[];
  gridLocations: string[];
  entityTypeFocus?: readonly string[];
  onPhase?: (phase: string, completed?: number) => void;
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

export type FillEntitySlotKeywordsFromGscResult = {
  rows: CSVRow[];
  keywordSources: EntitySapKeywordSources;
};

/** Upload preload: GSC + OpenRouter keyword fill only (no grid fallbacks). */
export async function fillEntitySlotKeywordsFromGsc(
  args: FillEntitySlotKeywordsFromGscArgs,
): Promise<FillEntitySlotKeywordsFromGscResult> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is required to assign keywords from GSC.");
  }
  const siteUrl = args.siteUrl.trim();
  if (!siteUrl) {
    throw new Error("WordPress site URL is required to load GSC keywords.");
  }

  args.onPhase?.("Loading site inventory and GSC cache", 0);
  const warm = await ensureEntitySiteWarmCache(args.site, { requireGsc: true });
  if (warm.error) {
    throw new Error(warm.error);
  }
  if (warm.inventory.totalRows === 0) {
    throw new Error(
      "WordPress sitemap inventory is empty. Connect the site and ensure Pages, Posts, and SAP sitemaps return URLs.",
    );
  }
  const gscQueries = gscQueriesFromWarmBundleForSapBudget(warm, args.rows.length);
  if (gscQueries.length === 0) {
    throw new Error(
      warm.error ||
        "Google Search Console returned no keywords for this site. Connect GSC and ensure query data exists.",
    );
  }

  const keywordSources: EntitySapKeywordSources = {
    links: warm.inventory.links,
    buckets: warm.inventory.buckets,
    gscQueries,
    gscDateRange: warm.gsc.dateRange,
  };

  const grouped = finalizeEntitySapRowsForAdGroups(args.rows.map((row) => ({ ...row })));
  args.onPhase?.("Assigning unique keywords from GSC", 0);
  const seedKeywords = new Array<string>(grouped.length).fill("");
  const withKeywords = await fillEntitySapRowKeywordsFromInventoryAndGsc({
    apiKey,
    model: args.model,
    siteId: args.site.id,
    siteName: args.siteName,
    siteUrl,
    rows: grouped,
    seedKeywords,
    buckets: keywordSources.buckets,
    gscQueries: keywordSources.gscQueries as GscSiteQueryRow[],
    gridLocations: args.gridLocations,
    ...(args.entityTypeFocus && args.entityTypeFocus.length > 0
      ? { entityTypeFocus: [...args.entityTypeFocus] }
      : {}),
    onGroupComplete: (partialRows, doneGroups, totalGroups) => {
      args.onRowsUpdate?.(partialRows);
      args.onPhase?.(
        "Assigning unique keywords from GSC",
        Math.min(Math.max(0, doneGroups - 1), Math.max(0, totalGroups - 1)),
      );
    },
  });

  const finalized = finalizeEntitySapRowsForAdGroups(withKeywords.map((row) => ({ ...row })));
  const blankCount = countBlankEntityKeywordRows(finalized);
  if (blankCount > 0) {
    throw new Error(
      `GSC keyword fill left ${blankCount} blank row${blankCount === 1 ? "" : "s"}. Connect GSC and retry upload.`,
    );
  }

  return { rows: finalized, keywordSources };
}

export type HydratePreloadedEntitySapRowsArgs = {
  apiKey: string;
  model: string;
  siteId?: string;
  siteName: string;
  siteUrl: string;
  rows: CSVRow[];
  targets: PreloadClusterKeywordTarget[];
  keywordSources: Pick<EntitySapKeywordSources, "buckets" | "gscQueries">;
  gridLocations: string[];
  entityTypeFocus?: readonly string[];
  clusterWikipedia?: GridClusterWikipedia[];
  skipKeywordFill?: boolean;
  onPhase?: (phase: string, completed?: number) => void;
  onRowsUpdate?: (rows: CSVRow[]) => void;
};

export async function hydratePreloadedEntitySapRows(
  args: HydratePreloadedEntitySapRowsArgs,
): Promise<{ rows: CSVRow[]; targets: PreloadClusterKeywordTarget[] }> {
  const groupedSapRows = finalizeEntitySapRowsForAdGroups(args.rows.map((row) => ({ ...row })));
  if (groupedSapRows.length === 0) {
    throw new Error("Clusters produced 0 SAP preview rows. Check grid weights and suggest output.");
  }

  let withKeywords = groupedSapRows;
  if (!args.skipKeywordFill) {
    args.onPhase?.("Assigning unique keywords from GSC", 0);
    const titleTargets = preloadTargetsToTitleTargets(args.targets);
    const seedKeywords = new Array<string>(groupedSapRows.length).fill("");
    const keywordJobs = buildEntityTitleClusterJobsFromTargets(titleTargets, groupedSapRows.length);
    for (const job of keywordJobs) {
      for (const idx of job.rowIndices) {
        if (idx >= 0 && idx < seedKeywords.length) seedKeywords[idx] = job.seedKeyword;
      }
    }

    withKeywords = await fillEntitySapRowKeywordsFromInventoryAndGsc({
      apiKey: args.apiKey,
      model: args.model,
      siteId: args.siteId,
      siteName: args.siteName,
      siteUrl: args.siteUrl,
      rows: groupedSapRows,
      seedKeywords,
      buckets: args.keywordSources.buckets,
      gscQueries: args.keywordSources.gscQueries as GscSiteQueryRow[],
      gridLocations: args.gridLocations,
      ...(args.entityTypeFocus && args.entityTypeFocus.length > 0
        ? { entityTypeFocus: args.entityTypeFocus }
        : {}),
      onGroupComplete: (partialRows, doneGroups, totalGroups) => {
        args.onRowsUpdate?.(partialRows);
        args.onPhase?.(
          "Assigning unique keywords from GSC",
          Math.min(Math.max(0, doneGroups - 1), Math.max(0, totalGroups - 1)),
        );
      },
    });
    const blankCount = countBlankEntityKeywordRows(withKeywords);
    if (blankCount > 0) {
      throw new Error(
        `GSC keyword fill left ${blankCount} blank row${blankCount === 1 ? "" : "s"}. Re-upload the grid after connecting GSC.`,
      );
    }
    args.onRowsUpdate?.(withKeywords);
  }

  args.onPhase?.("Writing titles", 0);
  let hydrated = withKeywords;
  try {
    hydrated = await hydrateEntityClusterSapRows({
      apiKey: args.apiKey,
      model: args.model,
      siteId: args.siteId,
      siteName: args.siteName,
      gridLocations: args.gridLocations,
      rows: withKeywords,
      ...(args.entityTypeFocus && args.entityTypeFocus.length > 0
        ? { entityTypeFocus: args.entityTypeFocus }
        : {}),
      onTitleProgress: (done) => {
        args.onPhase?.("Writing titles", done);
      },
      onMetaProgress: (done) => {
        args.onPhase?.("Writing meta descriptions", done);
      },
      onRowsUpdate: args.onRowsUpdate,
    });
  } catch {
    /* keep keyword rows when titles/meta hydrate fails */
  }

  if (hydrated.length === 0) {
    throw new Error("Clusters finished with 0 SAP rows after hydrate.");
  }

  const wiki = args.clusterWikipedia ?? [];
  const withWiki = wiki.length > 0 ? applyGridClusterWikipediaToSapRows(hydrated, wiki) : hydrated;
  return {
    rows: finalizeEntitySapRowsForAdGroups(withWiki.map((row) => ({ ...row }))),
    targets: args.targets,
  };
}
