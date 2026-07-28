import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type {
  CompetitorResearchSemrushResponse,
  GscSiteQueryRow,
  TieredCompetitorsResult,
} from "@/lib/competitor-research/types";
import type { GridKeywordWeight } from "@/lib/process-local-dominator-upload";
import { wikipediaSearchAugmentFromGridRows, type LocalDominatorRow } from "@/lib/local-dominator-csv";
import { enrichSapRowsWithWikipediaLookups } from "@/lib/wikipedia-api";
import { runLocalStrategySapSchedule } from "./local-strategy-sap-schedule-from-grid";
import { applySapOriginFromTitleToRows } from "@/lib/sap-origin-from-title";

/**
 * Single path for entity SAP bulk rows: Local Analysis tab (Analyze → entity SAP / blueprint SAP) and Proposal
 * Step 2 use this - same `runLocalStrategySapSchedule` args as Local (no proposal-only flags).
 */
export type LocalAnalysisEntitySapPipelineParams = {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  siteId?: string;
  siteName: string;
  siteUrl: string;
  entityLocation: string | null;
  semrush: CompetitorResearchSemrushResponse;
  tiers: TieredCompetitorsResult;
  selectedDomainKeys: Set<string>;
  gscQueries?: GscSiteQueryRow[];
  geoLabel: string | null;
  gridSummaryMarkdown: string | null;
  gridPlaceHints: string[];
  gridKeywordWeights: GridKeywordWeight[];
  gridParsedRows?: LocalDominatorRow[];
};

export async function runLocalAnalysisEntitySapPipeline(
  params: LocalAnalysisEntitySapPipelineParams,
): Promise<{ sapRows: CSVRow[]; usedFallback: boolean; builtFromGridDirect?: boolean }> {
  const { sapRows: sapRaw, usedFallback, builtFromGridDirect } = await runLocalStrategySapSchedule({
    apiKey: params.apiKey,
    model: params.model,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    topP: params.topP,
    siteId: params.siteId,
    siteName: params.siteName,
    siteUrl: params.siteUrl,
    entityLocation: params.entityLocation,
    semrush: params.semrush,
    tiers: params.tiers,
    selectedDomainKeys: params.selectedDomainKeys,
    gscQueries: params.gscQueries,
    geoLabel: params.geoLabel,
    gridSummaryMarkdown: params.gridSummaryMarkdown,
    gridPlaceHints: params.gridPlaceHints,
    gridKeywordWeights: params.gridKeywordWeights,
    gridParsedRows: params.gridParsedRows?.length ? params.gridParsedRows : undefined,
  });
  const wikiAug =
    params.gridParsedRows?.length ? wikipediaSearchAugmentFromGridRows(params.gridParsedRows) : undefined;
  const enriched = await enrichSapRowsWithWikipediaLookups(sapRaw, {
    siteId: params.siteId,
    wikipediaSearchAugment: wikiAug,
  });
  const sapRows = applySapOriginFromTitleToRows(enriched);
  return { sapRows, usedFallback, builtFromGridDirect };
}
