import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/lib/app-notifications";
import { ensureMasterInstructionsInMemory, hasMasterInstructions } from "@/lib/master-instructions-storage";
import { NOTIFY_ADD_AT_LEAST_ONE_TARGET_KEYWORD, NOTIFY_ADD_AT_LEAST_ONE_TARGET_KEYWORD_OR_CONNE, NOTIFY_ADD_SAP_BUDGET_ON_MEMBER_ROWS_OR_A_SINGL, NOTIFY_CONNECT_A_SITE_WITH_A_BUSINESS_NAME_IN_I, NOTIFY_DERIVING_KEYWORDS_FROM_POSTS, NOTIFY_ENTER_A_WEBSITE_URL_OR_A_FOCUS_LOCATION_, NOTIFY_ENTER_A_WHOLE_NUMBER_FOR_TOTAL_SAP_PAGES, NOTIFY_GENERATE_SAP_ROWS_FIRST, NOTIFY_GENERATING_SAP_ROWS, NOTIFY_GREPPING_WIKI_FOR_LOCATIONS, NOTIFY_LOADING_WORDPRESS_POST_LIBRARY, NOTIFY_NO_SAP_ROWS_TO_APPROVE, NOTIFY_NO_WORDPRESS_POST_LIST_IN_THIS_RESPONSE_, NOTIFY_OPENROUTER_IN_SETTINGS, NOTIFY_PREPARING_SAP, NOTIFY_RATE_LIMITED_429_RETRY_LATER, NOTIFY_READING_MASTER_RULES, NOTIFY_SAP_ROWS_APPROVED_FOR_CONTENT_PRODUCTION, NOTIFY_SAP_ROWS_READY, NOTIFY_SEED_SITE_URL_EXAMPLE, NOTIFY_SUGGESTING_KEYWORDS, NOTIFY_WORDPRESS_POST_LIBRARY_IS_EMPTY_ADD_KEYW, notifyCheckXEntityRowSVsCsv, notifyEnterAValidTotalSapPagesValueAtL, notifyFileTooLargeMaxXMb, notifyGridLoadedXPoints, notifySapScaledToXMaxX, notifyTotalSapPagesAcrossTargetsCannotEx, notifyTotalSapPagesCannotExceedX, notifyWikipediaXX, notifyXTargetsXSapGridNoWpInventory, notifyXTargetsXSapXPosts } from "@/lib/notify-messages";
import type { WordPressSite } from "@/components/integrations/types";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { SapGeneratorWorkspaceHeader } from "@/components/sap-generator/SapGeneratorWorkspaceHeader";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_INNER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import {
  defaultSeedEntityHintFromGrid,
  entityMatchesCsvPlaceHints,
  extractTopPlaceHintsFromRows,
  MAX_LOCAL_CSV_FILE_BYTES,
  parseLocalDominatorCsv,
  placeWeaknessWeightsFromRows,
  wikipediaSearchAugmentFromGridRows,
} from "@/lib/local-dominator-csv";
import {
  LOCAL_CSV_WORKER_FILE_BYTES_THRESHOLD,
  processLocalDominatorCsvText,
  type GridKeywordWeight,
  type PlaceWeaknessWeight,
} from "@/lib/process-local-dominator-upload";
import { fetchLocalSeoStrategyFromGrid } from "@/lib/local-seo-strategy-from-grid";
import {
  buildLocalAnalysisClientAudienceMarkdown,
  getPrimaryLabelForWikipediaAugment,
  mergeWikipediaSearchAugmentParts,
} from "@/lib/local-analysis-metro-context";
import { applySapOriginFromTitleToRows } from "@/lib/sap-origin-from-title";
import {
  LOCAL_ANALYSIS_DEFAULT_SAP_PAGES as DEFAULT_SAP_PAGES,
  LOCAL_ANALYSIS_SAP_MAX,
  LOCAL_ANALYSIS_SAP_MIN,
  LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET,
  LOCAL_ANALYSIS_TOTAL_SAP_CAP,
} from "@/lib/local-analysis-target-constants";

/** Per-keyword SAP default for new rows (not the campaign total in DEFAULT_SAP_PAGES). */
const PER_ROW_SAP_DEFAULT = LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET;
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import { parseCityRegionFromLooseLabel } from "@/lib/gmb-dfs-parse";
import {
  runEntityGridLocationClusterAgent,
  runEntityLocationClusterFromBuckets,
  applyGridClusterWikipediaToSapRows,
  isCityLevelOnlyEntity,
  type GridClusterWikipedia,
} from "@/lib/local-analysis/entity-grid-location-wiki-agent";
import {
  buildSitemapLocationBucketsFromInventory,
  sitemapLocationLabelsFromBuckets,
} from "@/lib/local-analysis/entity-sitemap-location-buckets";
import {
  finalizeEntitySapRowsForAdGroups,
} from "@/lib/local-analysis/sap-entity-ad-groups";
import {
  localAnalysisInventoryStorageKey,
} from "@/lib/local-analysis-suggest-from-inventory";
import {
  groupKeywordTargetRowsInOrder,
  inheritKeywordTargetEntityHints,
  keywordTargetsInGenerationOrder,
  migrateClusterSapToMembers,
  resolveClusterSeedEntityHint,
  seedRowIdForKeywordTarget,
  splitIntegerTotalAcrossMemberSlots,
} from "@/lib/local-analysis-keyword-cluster";
import { applySapTargetSlugsFromKeywordEntity } from "@/lib/sap-slug-from-keyword-entity";
import { repairSapPageAllocation, type SuggestedKeywordTarget } from "@/lib/local-analysis-suggest-keyword-targets";
import { fillKeywordsFromWpInventoryPosts } from "@/lib/local-analysis-fill-keywords-from-wp-inventory";
import { ensureBulkGenerationWpInventory, getBulkGenerationWpInventoryIfReady } from "@/lib/bulk/bulk-generation-wp-inventory";
import { downloadLocalAnalysisBulkCsv } from "@/lib/local-analysis-csv-export";
import { allRowIndicesSet } from "@/lib/bulk-processing-order";
import { fillSapRowMetaFromOpenRouter } from "@/lib/local-analysis/entity-sap-meta-agent";
import { fillSapRowTitlesFromOpenRouter } from "@/lib/local-analysis/entity-sap-title-agent";
import {
  fillEntitySapRowKeywordsFromInventoryAndGsc,
  type EntitySapKeywordSources,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import {
  ensureEntitySiteWarmCache,
  getEntitySiteWarmCacheIfReady,
  gscQueriesFromWarmBundleForSapBudget,
} from "@/lib/local-analysis/entity-site-warm-cache";
import {
  refreshEntityPreloadSlotKeywords,
  resolveSafeCityEntityLabel,
  isBadPreloadEntityLabel,
} from "@/lib/local-analysis/entity-preload-suggested-keywords";
import {
  clearEntityGridCsv,
  loadEntityGridCsv,
  saveEntityGridCsv,
} from "@/lib/local-analysis/entity-grid-csv-store";
import {
  seedPromptBlogSlots,
  syncPromptBlogRowsToCount,
} from "@/lib/bulk/prompt-blog-slots";
import { hydrateEntityClusterSapRows } from "@/lib/local-analysis/entity-preview-sap-hydrate";
import {
  entityGeneratorKeywordInventoryCount,
  mapEntityGeneratorKeywordInventoryPayload,
  pickEntityGeneratorKeywordInventoryRows,
} from "@/lib/local-analysis/entity-generator-keyword-inventory";
import {
  revokeBulkSitemapInventoryLinks,
  yieldFrameForDetailsPaint,
} from "@/lib/bulk/bulk-sitemap-inventory-session";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import {
  createBulkGscKeywordsHostedLink,
  revokeBulkGscKeywordsHostedLink,
  type BulkGscKeywordsHostedLink,
} from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { GscCompetitorDateRange, GscSiteQueryRow } from "@/lib/competitor-research/types";
import {
  buildEntityTitleClusterJobs,
  buildEntityTitleClusterJobsFromTargets,
  type EntityTitleClusterKeywordTarget,
} from "@/lib/local-analysis/entity-sap-title-cluster-jobs";
import {
  applyClusterHarnessPhase,
  buildEntityTitleHarnessGroupsFromTargets,
  countEntityHarnessSteps,
  hydrateEntityTitleHarnessFromSapRows,
  mergeEntityGenerateProgress,
  titlesMapFromRows,
} from "@/lib/local-analysis/entity-title-harness-state";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { loadApiKey } from "@/lib/api";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  getPrimaryCityStateLabel,
  getPrimaryLocationLabel,
  resolvePrimaryLocationLabel,
} from "@/lib/primary-location-from-site";
import { enrichSapRowsWithWikipediaLookupsInBatches, lookupEntityHintWikipedia, type EntityHintWikiLookup, type LookupEntityHintWikipediaOptions } from "@/lib/wikipedia-api";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ENTITY_GEOGRAPHIC_LEVEL,
  DEFAULT_ENTITY_TYPE_FOCUS,
  entityTypeFocusWantsNeighbourhoods,
  entityTypesForLevel,
  resolveEntityGeographicLevel,
  type EntityGeographicLevel,
} from "@/lib/entity-geographic-level";
import {
  buildLocalAnalysisMicroSnapshot,
  type LocalAnalysisHeaderProgress,
} from "@/lib/local-analysis/header-progress";
import { BulkEntityWorkspaceBody } from "@/components/keyword-research/bulk/BulkEntityWorkspaceBody";

export { DEFAULT_SAP_PAGES };

export type SapGeneratorLocalWorkspaceMode = "connected" | "temp";

export type LocalAnalysisWorkspaceControls = {
  mode: SapGeneratorLocalWorkspaceMode;
  onModeChange: (m: SapGeneratorLocalWorkspaceMode) => void;
  tempSeedUrl: string;
  onTempSeedUrlChange: (v: string) => void;
  showConnectedToggle: boolean;
  connectedSiteUrl: string | null;
  onPickTempFromConnected: () => void;
};

type WikiCellState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; lookup: EntityHintWikiLookup }
  | { status: "error" };

async function enrichSapRowsWithWikiLinks(
  rows: CSVRow[],
  options: LookupEntityHintWikipediaOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<{ enriched: CSVRow[]; wikiByIndex: Record<number, WikiCellState> }> {
  const total = rows.length;
  let done = 0;
  const enriched = await enrichSapRowsWithWikipediaLookupsInBatches(rows, options, 12);
  const wikiByIndex: Record<number, WikiCellState> = {};
  for (let gIdx = 0; gIdx < enriched.length; gIdx++) {
    wikiByIndex[gIdx] = sapRowToWikiCellState(enriched[gIdx]!);
    done += 1;
    onProgress?.(done, total);
  }
  return { enriched, wikiByIndex };
}

/** Build Wikipedia cell state from enriched SAP row (URLs from `enrichSapRowsWithWikipediaLookups*`). */
function sapRowToWikiCellState(row: CSVRow): WikiCellState {
  const url = row.wikipedia_url?.trim();
  const title = row.wikipedia_title?.trim();
  if (url && title) {
    return { status: "done", lookup: { kind: "exact", title, url } };
  }
  const entity = (row.entity ?? "").trim();
  if (!entity.length) return { status: "idle" };
  return { status: "done", lookup: { kind: "none", searchedQuery: entity } };
}

const SAP_COUNT_MIN = LOCAL_ANALYSIS_SAP_MIN;
const SAP_COUNT_MAX = LOCAL_ANALYSIS_SAP_MAX;
/** Max total SAP rows across all target keywords in one run. */
const TOTAL_SAP_CAP = LOCAL_ANALYSIS_TOTAL_SAP_CAP;
/** Soft warning when a large unfiltered grid may include many competitor rows. */
/** Digits from the budget field; empty or invalid uses min only for internal caps (does not rewrite the input). */
function sapBudgetIntFromLooseInput(raw: string): number {
  const digits = raw.trim().replace(/[^\d]/g, "");
  if (!digits) return SAP_COUNT_MIN;
  const n = Math.floor(Number(digits));
  if (!Number.isFinite(n) || n < 1) return SAP_COUNT_MIN;
  return n;
}

const LA_SESSION_KEY = (siteId: string) => `flowbie.local-analysis.v1.${siteId}`;

interface PersistedLocalAnalysisV1 {
  v: 1;
  /** Business / GBP-style name used with DataForSEO GMB info before suggest. */
  businessName?: string;
  gridSummaryMarkdown: string;
  gridKeywordWeights: GridKeywordWeight[];
  /** Per City, ST weakness from grid (optional for older sessions). */
  gridPlaceWeaknessWeights?: PlaceWeaknessWeight[];
  csvPlaceHints: string[];
  keywordTargets: KeywordTargetRow[];
  uploadLabel: string;
  /** Grid location rationale from last successful Generate SAP rows. */
  strategyMarkdown?: string;
  questionsByKeyword?: Record<string, string[]>;
  /** Last SAP rows (small runs only; restores generated list after refresh). */
  sapRows?: CSVRow[];
  /** True when sapRows were committed by a finished Generate (not mid-pipeline). */
  sapListRevealed?: boolean;
  /** Optional theme for AI suggest: most keyword targets center on this. */
  suggestFocusKeyword?: string;
  /** Optional geographic anchor for suggest + Generate SAP entity areas (city, region, country, etc.). */
  suggestFocusLocation?: string;
  /** Session-wide geographic scope for entity labels (SAP + suggest). */
  entityGeographicLevel?: EntityGeographicLevel;
  /** Optional subset of taxonomy lines to prioritize in prompts. */
  entityTypeFocus?: string[];
}

function newTargetRowId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface KeywordTargetRow {
  id: string;
  keyword: string;
  /** Optional geographic/service-area hint for SAP rows for this keyword; blank = model chooses from grid. */
  entityHint: string;
  sapPages: number;
  /** Semantic cluster: members inherit seed Wikipedia; omitted = single-row cluster. */
  clusterId?: string;
  clusterRole?: "seed" | "member";
}

type NormalizedKeywordTarget = {
  id: string;
  keyword: string;
  sapPages: number;
  entityHint?: string;
  clusterId?: string;
  clusterRole?: "seed" | "member";
};

function normalizeKeywordTargets(rows: KeywordTargetRow[]): {
  targets: NormalizedKeywordTarget[];
  total: number;
} {
  const migrated = migrateClusterSapToMembers(rows);
  const inherited = inheritKeywordTargetEntityHints(migrated) as KeywordTargetRow[];
  const hasMemberByCluster = new Set<string>();
  for (const r of inherited) {
    if (r.clusterRole === "member" && r.clusterId?.trim()) hasMemberByCluster.add(r.clusterId.trim());
  }
  const targets = inherited
    .map((r) => {
      const keyword = r.keyword.trim();
      const hint = normalizeEntityHintCommaLabel(r.entityHint ?? "");
      const isMember = r.clusterRole === "member";
      const cid = r.clusterId?.trim();
      const seedWithMembers = !isMember && cid != null && hasMemberByCluster.has(cid);
      const sapPages = isMember
        ? Math.min(SAP_COUNT_MAX, Math.max(SAP_COUNT_MIN, Math.floor(r.sapPages) || 0))
        : seedWithMembers
          ? 0
          : Math.min(SAP_COUNT_MAX, Math.max(SAP_COUNT_MIN, Math.floor(r.sapPages) || SAP_COUNT_MIN));
      const base: NormalizedKeywordTarget = {
        id: r.id,
        keyword,
        sapPages,
        ...(hint.length > 0 ? { entityHint: hint } : {}),
      };
      if (r.clusterId) base.clusterId = r.clusterId;
      if (r.clusterRole) base.clusterRole = r.clusterRole;
      return base;
    })
    .filter((r) => r.keyword.length > 0);
  const total = targets.reduce((s, t) => s + t.sapPages, 0);
  return { targets, total };
}

function sapBearingTargetsForAllocation(targets: NormalizedKeywordTarget[]): NormalizedKeywordTarget[] {
  const rowsForGrouping: KeywordTargetRow[] = targets.map((t) => ({
    id: t.id,
    keyword: t.keyword,
    entityHint: t.entityHint ?? "",
    sapPages: t.sapPages,
    clusterId: t.clusterId,
    clusterRole: t.clusterRole,
  }));
  const groups = groupKeywordTargetRowsInOrder(rowsForGrouping);
  const out: NormalizedKeywordTarget[] = [];
  for (const g of groups) {
    if (g.members.length > 0) {
      for (const m of g.members) {
        const nt = targets.find((x) => x.id === m.id);
        if (nt) out.push(nt);
      }
    } else if (g.seed.keyword.trim() && (Math.floor(g.seed.sapPages) || 0) > 0) {
      const nt = targets.find((x) => x.id === g.seed.id);
      if (nt) out.push(nt);
    }
  }
  return out;
}

function mergeRepairedSapBearingIntoTargets(
  allTargets: NormalizedKeywordTarget[],
  sapBearing: NormalizedKeywordTarget[],
  repaired: SuggestedKeywordTarget[]
): NormalizedKeywordTarget[] {
  if (repaired.length === sapBearing.length) {
    const byId = new Map(sapBearing.map((t, i) => [t.id, repaired[i]!.sapPages]));
    return allTargets.map((t) => (byId.has(t.id) ? { ...t, sapPages: byId.get(t.id)! } : t));
  }
  const totalRepaired = repaired.reduce((s, r) => s + r.sapPages, 0);
  if (totalRepaired <= 0 || sapBearing.length === 0) return allTargets;
  const splits = splitIntegerTotalAcrossMemberSlots(
    totalRepaired,
    sapBearing.length,
    LOCAL_ANALYSIS_SAP_MIN,
    LOCAL_ANALYSIS_SAP_MAX
  );
  const byId = new Map(sapBearing.map((t, i) => [t.id, splits[i]!]));
  return allTargets.map((t) => (byId.has(t.id) ? { ...t, sapPages: byId.get(t.id)! } : t));
}

/** Map suggest API rows to panel rows; normalize (0→1 for lone seeds) then repair down to wand budget if needed. */
function keywordTargetsFromSuggestResult(
  result: SuggestedKeywordTarget[],
  maxSapBudget: number,
): KeywordTargetRow[] {
  const rows: KeywordTargetRow[] = result.map((t) => ({
    id: newTargetRowId(),
    keyword: t.keyword,
    entityHint: t.clusterRole === "member" ? "" : (t.entityHint ?? ""),
    sapPages: t.sapPages,
    ...(t.clusterId ? { clusterId: t.clusterId } : {}),
    ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
  }));
  const { targets, total } = normalizeKeywordTargets(rows);
  if (targets.length === 0) return rows;
  const sapBearing = sapBearingTargetsForAllocation(targets);
  if (sapBearing.length === 0) return rows;
  if (total === maxSapBudget) {
    return targets.map((t) => ({
      id: t.id,
      keyword: t.keyword,
      entityHint: t.entityHint ?? "",
      sapPages: t.sapPages,
      ...(t.clusterId ? { clusterId: t.clusterId } : {}),
      ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
    }));
  }
  const repaired = repairSapPageAllocation(
    sapBearing.map((t) => ({
      keyword: t.keyword,
      sapPages: t.sapPages,
      ...(t.entityHint ? { entityHint: t.entityHint } : {}),
      ...(t.clusterId ? { clusterId: t.clusterId } : {}),
      ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
    })),
    maxSapBudget,
    LOCAL_ANALYSIS_SAP_MIN,
    LOCAL_ANALYSIS_SAP_MAX,
  );
  const merged = mergeRepairedSapBearingIntoTargets(targets, sapBearing, repaired);
  return merged.map((t) => ({
    id: t.id,
    keyword: t.keyword,
    entityHint: t.entityHint ?? "",
    sapPages: t.sapPages,
    ...(t.clusterId ? { clusterId: t.clusterId } : {}),
    ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
  }));
}

function keywordTargetsForApi(targets: NormalizedKeywordTarget[]): { keyword: string; sapPages: number; entityHint?: string }[] {
  return targets
    .filter((t) => t.sapPages > 0)
    .map(({ keyword, sapPages, entityHint }) => ({
      keyword,
      sapPages,
      ...(entityHint != null && entityHint.length > 0 ? { entityHint } : {}),
    }));
}

function keywordTargetRowsToTitleTargets(rows: KeywordTargetRow[]): EntityTitleClusterKeywordTarget[] {
  return rows.map((t) => ({
    id: t.id,
    keyword: t.keyword,
    entityHint: t.entityHint ?? "",
    sapPages: t.sapPages,
    ...(t.clusterId ? { clusterId: t.clusterId } : {}),
    ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
  }));
}

/** Slots from OpenRouter cluster targets — entity is the OpenRouter neighbourhood label only. */
function previewRowsFromKeywordTargets(
  rows: KeywordTargetRow[],
  maxBudget: number,
): { rows: CSVRow[]; seedKeywords: string[] } {
  const ordered = keywordTargetsInGenerationOrder(
    rows.map((r) => ({
      id: r.id,
      keyword: r.keyword,
      entityHint: r.entityHint ?? "",
      sapPages: r.sapPages,
      ...(r.clusterId ? { clusterId: r.clusterId } : {}),
      ...(r.clusterRole ? { clusterRole: r.clusterRole } : {}),
    })),
  ) as KeywordTargetRow[];
  const { targets } = normalizeKeywordTargets(ordered);
  const out: CSVRow[] = [];
  const seedKeywords: string[] = [];
  for (const t of targets) {
    if (!t.keyword.trim() || t.sapPages <= 0) continue;
    const entity = normalizeEntityHintCommaLabel((t.entityHint ?? "").trim());
    if (!entity) {
      throw new Error(`Cluster target missing neighbourhood entity for keyword «${t.keyword}».`);
    }
    for (let p = 0; p < t.sapPages; p++) {
      out.push({
        keyword: "",
        entity,
        title: "",
        modifier: "",
        featuredImage: "google-maps",
      });
      seedKeywords.push(t.keyword);
      if (out.length >= maxBudget) return { rows: out, seedKeywords };
    }
  }
  return { rows: out, seedKeywords };
}

/** First row index in `apiTargets` that shares the cluster and is not a member (seed). */
function seedRowIndexForTargetTi(apiTargets: NormalizedKeywordTarget[], ti: number): number {
  const row = apiTargets[ti];
  if (!row) return ti;
  const cid = row.clusterId?.trim();
  if (cid) {
    const idx = apiTargets.findIndex((x) => x.clusterId?.trim() === cid && x.clusterRole !== "member");
    if (idx >= 0) return idx;
  }
  return ti;
}

export interface LocalAnalysisPanelProps {
  site: WordPressSite;
  workspace: LocalAnalysisWorkspaceControls;
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  apiKey: string;
  dataForSEOApiKey: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  flowPurpose?: string;
}

export const LocalAnalysisPanel: React.FC<LocalAnalysisPanelProps> = ({
  site,
  workspace,
  activeSection,
  onSectionChange,
  apiKey,
  dataForSEOApiKey,
  selectedModel,
  temperature,
  maxTokens,
  topP,
  flowPurpose,
}) => {
  const [uploadLabel, setUploadLabel] = useState<string>("");
  const [csvParsing, setCsvParsing] = useState(false);
  const [gridSummaryMarkdown, setGridSummaryMarkdown] = useState<string>("");
  /** Weakness-by-keyword from last grid CSV (drives weighted SAP allocation on suggest). */
  const [gridKeywordWeights, setGridKeywordWeights] = useState<GridKeywordWeight[]>([]);
  /** Per City, ST from grid CSV (weaker avg rank = higher weight; wiki snap order + RAG). */
  const [gridPlaceWeaknessWeights, setGridPlaceWeaknessWeights] = useState<PlaceWeaknessWeight[]>([]);
  /** City/region hints from last successful CSV parse (soft entity check after model run). */
  const [csvPlaceHints, setCsvPlaceHints] = useState<string[]>([]);
  /** Last uploaded grid CSV text (full file - passed verbatim to AI suggest with the markdown scan). */
  const [gridCsvFullText, setGridCsvFullText] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [keywordTargets, setKeywordTargets] = useState<KeywordTargetRow[]>(() => {
    const cid = newTargetRowId();
    return [{ id: newTargetRowId(), keyword: "", entityHint: "", sapPages: PER_ROW_SAP_DEFAULT, clusterRole: "seed", clusterId: cid }];
  });
  const [sapRows, setSapRows] = useState<CSVRow[]>([]);
  /** Editable preload slots before Clusters produces SAP rows (amount → N rows). */
  const [entitySlotRows, setEntitySlotRows] = useState<CSVRow[]>(() =>
    seedPromptBlogSlots(DEFAULT_SAP_PAGES),
  );
  const entitySlotRowsRef = useRef(entitySlotRows);
  entitySlotRowsRef.current = entitySlotRows;
  const entitySlotFillGenRef = useRef(0);
  const [entitySelectedRowIndices, setEntitySelectedRowIndices] = useState<Set<number>>(() => new Set());
  const [sitemapInventoryLinks, setSitemapInventoryLinks] = useState<PromptBulkSitemapInventoryLink[]>([]);
  const sitemapLinksRef = useRef<PromptBulkSitemapInventoryLink[]>([]);
  const [gscKeywordsHostedLink, setGscKeywordsHostedLink] = useState<BulkGscKeywordsHostedLink | null>(null);
  const gscLinkRef = useRef<BulkGscKeywordsHostedLink | null>(null);
  const entityKeywordSourcesRef = useRef<EntitySapKeywordSources | null>(null);
  /** Location rationale markdown from last grid analysis (download + session). */
  const [strategyMarkdown, setStrategyMarkdown] = useState("");
  const [questionsByKeyword, setQuestionsByKeyword] = useState<Record<string, string[]>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [headerProgress, setHeaderProgress] = useState<LocalAnalysisHeaderProgress | null>(null);
  const [sapPageBudgetInput, setSapPageBudgetInput] = useState(() => String(DEFAULT_SAP_PAGES));
  /** Optional: most suggested keywords will center on this theme (OpenRouter). */
  const [suggestFocusKeyword, setSuggestFocusKeyword] = useState("");
  const [suggestFocusLocation, setSuggestFocusLocation] = useState("");
  const [entityGeographicLevel, setEntityGeographicLevel] = useState<EntityGeographicLevel>(
    DEFAULT_ENTITY_GEOGRAPHIC_LEVEL
  );
  const [entityTypeFocus, setEntityTypeFocus] = useState<string[]>(() => [...DEFAULT_ENTITY_TYPE_FOCUS]);
  const [wikiByTargetId, setWikiByTargetId] = useState<Record<string, WikiCellState>>({});
  /** Wikipedia for generated SAP rows, keyed by global row index - filled once per Generate, not refetched on edit. */
  const [wikiBySapRowIndex, setWikiBySapRowIndex] = useState<Record<number, WikiCellState>>({});
  /** Reuse keyword entity-hint lookups when the same hint string appears again (avoids refetch on unrelated re-renders). */
  const wikiHintCacheRef = useRef<Map<string, WikiCellState>>(new Map());
  const wikiByTargetIdRef = useRef(wikiByTargetId);
  wikiByTargetIdRef.current = wikiByTargetId;
  /** Primary city/region from site (ACF/sync); refined async for Wikipedia augment merge. */
  const [primaryWikiAugmentLabel, setPrimaryWikiAugmentLabel] = useState<string | undefined>(() =>
    getPrimaryCityStateLabel(site)?.trim() || undefined
  );
  /** Canonical `###` titles from `buildWikipediaGranularEntityPool` for pool-first Wikipedia resolution. */
  const [granularPoolTitles, setGranularPoolTitles] = useState<string[]>([]);

  const isTempWorkspace = workspace.mode === "temp";
  const researchModel = useMemo(
    () => getResearchModel(isTempWorkspace ? undefined : site.id),
    [isTempWorkspace, site.id]
  );
  const openRouterKey = apiKey?.trim() || loadApiKey();

  const workspaceBusy = csvParsing || isAnalyzing || suggestLoading;
  const clustersRunLoading = suggestLoading || isAnalyzing;

  /** User SAP row budget (wand number); caps generate + displayed SAP rows / confirm, not padded upward. */
  const maxSapBudget = useMemo(() => sapBudgetIntFromLooseInput(sapPageBudgetInput), [sapPageBudgetInput]);

  const placeWeaknessForSuggest = useMemo(() => {
    if (gridPlaceWeaknessWeights.length > 0) return gridPlaceWeaknessWeights;
    const t = gridCsvFullText.trim();
    if (!t) return [];
    const parsed = parseLocalDominatorCsv(t);
    if (parsed.error || parsed.rows.length === 0) return [];
    return placeWeaknessWeightsFromRows(parsed.rows);
  }, [gridPlaceWeaknessWeights, gridCsvFullText]);

  const gridCsvWikipediaAugment = useMemo(() => {
    const t = gridCsvFullText.trim();
    if (!t) return undefined;
    const parsed = parseLocalDominatorCsv(t);
    if (parsed.error || parsed.rows.length === 0) return undefined;
    return wikipediaSearchAugmentFromGridRows(parsed.rows);
  }, [gridCsvFullText]);

  const gridLocations = useMemo(() => {
    const t = gridCsvFullText.trim();
    if (!t) return [];
    const parsed = parseLocalDominatorCsv(t);
    if (parsed.error || parsed.rows.length === 0) return [];
    const limit = Math.ceil(maxSapBudget / LOCAL_ANALYSIS_SUGGEST_SAP_MIN_PER_TARGET) + 10;
    return extractTopPlaceHintsFromRows(parsed.rows, limit);
  }, [gridCsvFullText, maxSapBudget]);

  const mergedWikipediaSearchAugment = useMemo(
    () =>
      mergeWikipediaSearchAugmentParts({
        gridCsvAugment: gridCsvWikipediaAugment,
        suggestFocusLocation: suggestFocusLocation?.trim() || undefined,
        primarySiteLabel: primaryWikiAugmentLabel,
      }),
    [gridCsvWikipediaAugment, suggestFocusLocation, primaryWikiAugmentLabel]
  );

  const progressSnapshot = useMemo(
    () => buildLocalAnalysisMicroSnapshot(headerProgress),
    [headerProgress],
  );

  const commitSitemapInventoryLinks = useCallback((links: PromptBulkSitemapInventoryLink[]) => {
    revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
    sitemapLinksRef.current = links;
    setSitemapInventoryLinks(links);
  }, []);

  const commitGscKeywordsHostedLink = useCallback(
    (siteUrl: string, queries: GscSiteQueryRow[], dateRange?: GscCompetitorDateRange) => {
      revokeBulkGscKeywordsHostedLink(gscLinkRef.current);
      const link = createBulkGscKeywordsHostedLink(siteUrl, queries, dateRange);
      gscLinkRef.current = link;
      setGscKeywordsHostedLink(link);
    },
    [],
  );

  const clearGscKeywordsHostedLink = useCallback(() => {
    revokeBulkGscKeywordsHostedLink(gscLinkRef.current);
    gscLinkRef.current = null;
    setGscKeywordsHostedLink(null);
  }, []);

  const canOpenDetails = useMemo(
    () =>
      workspaceBusy ||
      Boolean(uploadLabel.trim()) ||
      keywordTargets.some((r) => r.keyword.trim().length > 0) ||
      gridSummaryMarkdown.trim().length > 0 ||
      strategyMarkdown.trim().length > 0 ||
      sapRows.length > 0 ||
      sitemapInventoryLinks.length > 0 ||
      Boolean(gscKeywordsHostedLink),
    [
      workspaceBusy,
      uploadLabel,
      keywordTargets,
      gridSummaryMarkdown,
      strategyMarkdown,
      sapRows.length,
      sitemapInventoryLinks.length,
      gscKeywordsHostedLink,
    ],
  );

  useEffect(() => {
    return () => {
      revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
      sitemapLinksRef.current = [];
      revokeBulkGscKeywordsHostedLink(gscLinkRef.current);
      gscLinkRef.current = null;
    };
  }, [site.id]);

  const granularPoolTitlesKey = useMemo(() => granularPoolTitles.slice(0, 400).join("\t"), [granularPoolTitles]);

  const clientAudienceContextMarkdown = useMemo(() => {
    let inv: { title: string; keyword: string }[] | undefined;
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(localAnalysisInventoryStorageKey(site.id));
        if (raw) {
          const trimmed = raw.trim();
          if (!trimmed) {
            /* empty */
          } else if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
            inv = trimmed
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .slice(0, 12)
              .map((keyword) => ({ title: keyword, keyword }));
          } else {
            const p = JSON.parse(raw) as
              | string[]
              | { posts?: Array<{ title?: string; fields?: { title?: string; keyword?: string } }> };
            if (Array.isArray(p) && p.length > 0 && typeof p[0] === "string") {
              inv = p.slice(0, 12).map((keyword) => ({
                title: keyword.trim(),
                keyword: keyword.trim(),
              }));
            } else if (!Array.isArray(p) && p.posts?.length) {
              inv = p.posts.slice(0, 12).map((post) => ({
                title: post.title ?? post.fields?.title ?? "",
                keyword: post.fields?.keyword ?? "",
              }));
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    const name = businessName.trim() || site.name?.trim();
    return buildLocalAnalysisClientAudienceMarkdown({
      ...(name ? { businessName: name } : {}),
      siteName: site.name,
      siteUrl: isTempWorkspace ? workspace.tempSeedUrl : site.siteUrl,
      focusKeyword: suggestFocusKeyword,
      focusLocation: suggestFocusLocation,
      entityGeographicLevel,
      ...(entityTypeFocus.length > 0 ? { entityTypeFocusLabels: entityTypeFocus } : {}),
      inventorySample: inv,
      themeMixGovernedByMasterRules: !isTempWorkspace && hasMasterInstructions(site.id),
    }).trim();
  }, [
    businessName,
    site.name,
    site.siteUrl,
    site.id,
    isTempWorkspace,
    workspace.tempSeedUrl,
    suggestFocusKeyword,
    suggestFocusLocation,
    entityGeographicLevel,
    entityTypeFocus,
  ]);

  const localAnalysisWikiLookupOptions = useMemo(
    () => ({
      siteId: site.id,
      wikipediaSearchAugment: mergedWikipediaSearchAugment,
      ...(granularPoolTitles.length > 0 ? { preferredTitles: granularPoolTitles } : {}),
      ...(placeWeaknessForSuggest.length > 0 ? { gridPlaceWeights: placeWeaknessForSuggest } : {}),
    }),
    [site.id, mergedWikipediaSearchAugment, granularPoolTitles, placeWeaknessForSuggest]
  );

  useEffect(() => {
    let cancelled = false;
    void getPrimaryLabelForWikipediaAugment(site).then((label) => {
      if (!cancelled && label?.trim()) setPrimaryWikiAugmentLabel(label.trim());
    });
    return () => {
      cancelled = true;
    };
  }, [site]);

  useEffect(() => {
    setPrimaryWikiAugmentLabel(getPrimaryCityStateLabel(site)?.trim() || undefined);
    setGranularPoolTitles([]);
  }, [site.id]); // eslint-disable-line react-hooks/exhaustive-deps -- `site` keyed by id only; avoid clearing pool on unrelated `site` reference churn

  useEffect(() => {
    const allowed = new Set(entityTypesForLevel(entityGeographicLevel));
    setEntityTypeFocus((prev) => {
      const next = prev.filter((t) => allowed.has(t));
      return next.length === prev.length ? prev : next;
    });
  }, [entityGeographicLevel]);

  const keywordTargetsRef = useRef(keywordTargets);
  keywordTargetsRef.current = keywordTargets;

  useEffect(() => {
    wikiHintCacheRef.current.clear();
  }, [site.id, gridCsvFullText, mergedWikipediaSearchAugment, granularPoolTitlesKey]);

  useEffect(() => {
    if (!isTempWorkspace && site.name?.trim()) {
      setBusinessName((prev) => (prev === "" ? site.name.trim() : prev));
    }
  }, [isTempWorkspace, site.id, site.name]);

  const targetsWikiKey = useMemo(
    () =>
      JSON.stringify(
        keywordTargets
          .filter((r) => r.clusterRole !== "member")
          .map((r) => ({ id: r.id, h: r.entityHint }))
      ),
    [keywordTargets]
  );

  /* eslint-disable react-hooks/exhaustive-deps -- keywordTargets summarized in targetsWikiKey */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const row of keywordTargets) {
      if (row.clusterRole === "member") continue;
      const hint = row.entityHint.trim();
      const { id } = row;
      if (!hint) {
        setWikiByTargetId((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        continue;
      }
      const cacheKey = `${hint.toLowerCase()}\t${mergedWikipediaSearchAugment ?? ""}\t${granularPoolTitlesKey}`;
      const cached = wikiHintCacheRef.current.get(cacheKey);
      if (cached?.status === "done") {
        setWikiByTargetId((prev) => ({ ...prev, [id]: cached }));
        continue;
      }
      const t = setTimeout(() => {
        setWikiByTargetId((prev) => ({ ...prev, [id]: { status: "loading" } }));
        void lookupEntityHintWikipedia(hint, localAnalysisWikiLookupOptions)
          .then((lookup) => {
            const current = keywordTargetsRef.current.find((r) => r.id === id)?.entityHint.trim();
            if (current !== hint) return;
            const done: WikiCellState = { status: "done", lookup };
            wikiHintCacheRef.current.set(cacheKey, done);
            setWikiByTargetId((prev) => ({ ...prev, [id]: done }));
          })
          .catch(() => {
            const current = keywordTargetsRef.current.find((r) => r.id === id)?.entityHint.trim();
            if (current !== hint) return;
            setWikiByTargetId((prev) => ({ ...prev, [id]: { status: "error" } }));
          });
      }, 450);
      timers.push(t);
    }
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [targetsWikiKey, site.id, mergedWikipediaSearchAugment, granularPoolTitlesKey, localAnalysisWikiLookupOptions]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LA_SESSION_KEY(site.id));
      if (!raw) return;
      const p = JSON.parse(raw) as PersistedLocalAnalysisV1;
      if (p.v !== 1) return;
      if (typeof p.businessName === "string") setBusinessName(p.businessName);
      if (typeof p.gridSummaryMarkdown === "string") setGridSummaryMarkdown(p.gridSummaryMarkdown);
      setGridKeywordWeights(Array.isArray(p.gridKeywordWeights) ? p.gridKeywordWeights : []);
      setGridPlaceWeaknessWeights(
        Array.isArray(p.gridPlaceWeaknessWeights) ? p.gridPlaceWeaknessWeights : []
      );
      setCsvPlaceHints(Array.isArray(p.csvPlaceHints) ? p.csvPlaceHints : []);
      // Keyword targets are not restored — user must run Clusters explicitly.
      // Grid CSV lives in IndexedDB (restored separately); never keep a stale ready label alone.
      if (typeof p.uploadLabel === "string" && p.uploadLabel.trim()) {
        setUploadLabel("");
      }
      if (typeof p.strategyMarkdown === "string") setStrategyMarkdown(p.strategyMarkdown);
      if (p.questionsByKeyword && typeof p.questionsByKeyword === "object") {
        setQuestionsByKeyword(p.questionsByKeyword);
      }
      if (p.sapListRevealed && Array.isArray(p.sapRows) && p.sapRows.length > 0) {
        const restored = finalizeEntitySapRowsForAdGroups(
          applySapOriginFromTitleToRows(p.sapRows as CSVRow[]),
        );
        setSapRows(restored);
        setEntitySelectedRowIndices(allRowIndicesSet(restored.length));
      }
      if (typeof p.suggestFocusKeyword === "string") setSuggestFocusKeyword(p.suggestFocusKeyword);
      if (typeof p.suggestFocusLocation === "string") setSuggestFocusLocation(p.suggestFocusLocation);
      if (p.entityGeographicLevel === "national" || p.entityGeographicLevel === "provincial" || p.entityGeographicLevel === "city") {
        setEntityGeographicLevel(resolveEntityGeographicLevel(p.entityGeographicLevel));
      }
      if (Array.isArray(p.entityTypeFocus) && p.entityTypeFocus.length > 0) {
        const allowed = new Set(entityTypesForLevel(resolveEntityGeographicLevel(p.entityGeographicLevel)));
        const restored = p.entityTypeFocus.filter((t) => allowed.has(t));
        if (restored.length > 0) setEntityTypeFocus(restored);
      }
    } catch {
      /* ignore */
    }
  }, [site.id]);

  /** Restore Local Dominator CSV from IndexedDB so Neighbourhood AdGroups can populate after refresh. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadEntityGridCsv(site.id);
      if (cancelled || !saved?.csvText?.trim()) return;
      setGridCsvFullText(saved.csvText);
      if (saved.uploadLabel) setUploadLabel(saved.uploadLabel);
    })();
    return () => {
      cancelled = true;
    };
  }, [site.id]);

  useEffect(() => {
    const hasPersistable =
      businessName.trim().length > 0 ||
      gridSummaryMarkdown.trim().length > 0 ||
      keywordTargets.some((r) => r.keyword.trim().length > 0) ||
      sapRows.length > 0 ||
      strategyMarkdown.trim().length > 0 ||
      suggestFocusKeyword.trim().length > 0 ||
      suggestFocusLocation.trim().length > 0 ||
      entityGeographicLevel !== DEFAULT_ENTITY_GEOGRAPHIC_LEVEL ||
      entityTypeFocus.length > 0;
    if (!hasPersistable) return;
    const t = window.setTimeout(() => {
      try {
        const snap: PersistedLocalAnalysisV1 = {
          v: 1,
          businessName: businessName.trim() || undefined,
          gridSummaryMarkdown,
          gridKeywordWeights,
          gridPlaceWeaknessWeights:
            gridPlaceWeaknessWeights.length > 0 ? gridPlaceWeaknessWeights : undefined,
          csvPlaceHints,
          keywordTargets,
          uploadLabel,
          strategyMarkdown: strategyMarkdown.trim() || undefined,
          questionsByKeyword:
            Object.keys(questionsByKeyword).length > 0 ? questionsByKeyword : undefined,
          sapRows: sapRows.length > 0 ? sapRows : undefined,
          sapListRevealed: sapRows.length > 0 ? true : undefined,
          suggestFocusKeyword: suggestFocusKeyword.trim() || undefined,
          suggestFocusLocation: suggestFocusLocation.trim() || undefined,
          entityGeographicLevel:
            entityGeographicLevel !== DEFAULT_ENTITY_GEOGRAPHIC_LEVEL ? entityGeographicLevel : undefined,
          entityTypeFocus: (() => {
            const allowed = entityTypesForLevel(entityGeographicLevel);
            const next = entityTypeFocus.filter((t) => allowed.includes(t));
            return next.length > 0 ? next : undefined;
          })(),
        };
        sessionStorage.setItem(LA_SESSION_KEY(site.id), JSON.stringify(snap));
      } catch {
        /* quota */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    site.id,
    businessName,
    gridSummaryMarkdown,
    gridKeywordWeights,
    gridPlaceWeaknessWeights,
    csvPlaceHints,
    keywordTargets,
    uploadLabel,
    strategyMarkdown,
    questionsByKeyword,
    sapRows,
    suggestFocusKeyword,
    suggestFocusLocation,
    entityGeographicLevel,
    entityTypeFocus,
  ]);

  const resetAnalysisOutput = useCallback(() => {
    setSapRows([]);
    setEntitySlotRows(seedPromptBlogSlots(DEFAULT_SAP_PAGES));
    entitySlotFillGenRef.current += 1;
    setEntitySelectedRowIndices(new Set());
    revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
    sitemapLinksRef.current = [];
    setSitemapInventoryLinks([]);
    clearGscKeywordsHostedLink();
    entityKeywordSourcesRef.current = null;
    setStrategyMarkdown("");
    setQuestionsByKeyword({});
    setWikiBySapRowIndex({});
  }, []);

  /** Full reset: grid upload, targets, generated SAP, strategies, and saved session for this site. */
  const clearLocalAnalysis = useCallback(() => {
    resetAnalysisOutput();
    setWikiByTargetId({});
    setGridSummaryMarkdown("");
    setGridKeywordWeights([]);
    setGridPlaceWeaknessWeights([]);
    setCsvPlaceHints([]);
    setGridCsvFullText("");
    if (isTempWorkspace) {
      setBusinessName("");
    }
    setUploadLabel("");
    void clearEntityGridCsv(site.id);
    setKeywordTargets(() => {
      const cid = newTargetRowId();
      return [{ id: newTargetRowId(), keyword: "", entityHint: "", sapPages: PER_ROW_SAP_DEFAULT, clusterRole: "seed", clusterId: cid }];
    });
    setSapPageBudgetInput(String(DEFAULT_SAP_PAGES));
    setSuggestFocusKeyword("");
    setSuggestFocusLocation("");
    setEntityGeographicLevel(DEFAULT_ENTITY_GEOGRAPHIC_LEVEL);
    setEntityTypeFocus([...DEFAULT_ENTITY_TYPE_FOCUS]);
    setHeaderProgress(null);
    try {
      sessionStorage.removeItem(LA_SESSION_KEY(site.id));
    } catch {
      /* ignore */
    }
    notify.message(
      isTempWorkspace
        ? "Local analysis reset."
        : "Grid and keyword targets cleared (business name kept for this site).",
      { duration: 4_000 },
    );
  }, [resetAnalysisOutput, site.id, isTempWorkspace]);

  const runCsvPipeline = useCallback(
    async (text: string, fileSizeHint: number, fileLabel = "") => {
      const useWorker = fileSizeHint >= LOCAL_CSV_WORKER_FILE_BYTES_THRESHOLD;
      setCsvParsing(true);
      setHeaderProgress({ kind: "csv", phase: "Parsing grid CSV…", completed: 0, total: 0 });
      try {
        const result = await processLocalDominatorCsvText(text, useWorker);
        if (result.ok === false) {
          notify.error(result.error);
          setGridSummaryMarkdown("");
          setGridKeywordWeights([]);
          setGridPlaceWeaknessWeights([]);
          setCsvPlaceHints([]);
          setGridCsvFullText("");
          return;
        }
        setGridCsvFullText(text);
        setGridSummaryMarkdown(result.gridSummaryMarkdown);
        setGridKeywordWeights(result.gridKeywordWeights);
        setGridPlaceWeaknessWeights(result.placeWeaknessWeights);
        setCsvPlaceHints(result.placeHints);
        void saveEntityGridCsv({
          siteId: site.id,
          uploadLabel: fileLabel,
          csvText: text,
        });
        setKeywordTargets(() => {
          const cid = newTargetRowId();
          return [
            {
              id: newTargetRowId(),
              keyword: "",
              entityHint: "",
              sapPages: PER_ROW_SAP_DEFAULT,
              clusterRole: "seed" as const,
              clusterId: cid,
            },
          ];
        });

        notify.success(notifyGridLoadedXPoints(result.loadedRowCount));
      } finally {
        setCsvParsing(false);
        setHeaderProgress(null);
      }
    },
    [site.id]
  );

  const onPickFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (file.size > MAX_LOCAL_CSV_FILE_BYTES) {
        notify.error(notifyFileTooLargeMaxXMb(Math.round(MAX_LOCAL_CSV_FILE_BYTES / (1024 * 1024))));
        return;
      }
      setUploadLabel(file.name);
      resetAnalysisOutput();
      const reader = new FileReader();
      reader.onload = () => {
        void (async () => {
          const text = String(reader.result ?? "");
          await runCsvPipeline(text, file.size, file.name);
        })();
      };
      reader.readAsText(file);
    },
    [resetAnalysisOutput, runCsvPipeline]
  );

  const assignUniqueEntitySapKeywords = useCallback(
    async (
      rows: CSVRow[],
      keywordTargetsForSeeds?: EntityTitleClusterKeywordTarget[],
    ): Promise<CSVRow[]> => {
      if (rows.length === 0) return rows;
      if (!openRouterKey) {
        throw new Error(NOTIFY_OPENROUTER_IN_SETTINGS);
      }
      const sources = entityKeywordSourcesRef.current;
      if (!sources) {
        throw new Error("Sitemap inventory and GSC keywords must be loaded before assigning row keywords.");
      }
      const siteName = businessName.trim() || site.name?.trim() || "Site";
      const siteUrl = isTempWorkspace ? workspace.tempSeedUrl.trim() : (site.siteUrl?.trim() ?? "");
      const seedKeywords = new Array<string>(rows.length).fill("");
      if (keywordTargetsForSeeds?.length) {
        const jobs = buildEntityTitleClusterJobsFromTargets(keywordTargetsForSeeds, rows.length);
        for (const job of jobs) {
          for (const idx of job.rowIndices) {
            if (idx >= 0 && idx < seedKeywords.length) seedKeywords[idx] = job.seedKeyword;
          }
        }
      }
      return fillEntitySapRowKeywordsFromInventoryAndGsc({
        apiKey: openRouterKey,
        model: researchModel,
        siteId: isTempWorkspace ? undefined : site.id,
        siteName,
        siteUrl,
        rows,
        seedKeywords,
        buckets: sources.buckets,
        gscQueries: sources.gscQueries,
        gridLocations,
        ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
      });
    },
    [openRouterKey, site, businessName, isTempWorkspace, workspace.tempSeedUrl, researchModel, entityTypeFocus, gridLocations],
  );

  const runAnalysis = useCallback(async (targetsOverride?: KeywordTargetRow[]) => {
    if (!openRouterKey) {
      notify.error(NOTIFY_OPENROUTER_IN_SETTINGS);
      return;
    }
    if (isTempWorkspace && !site.siteUrl?.trim()) {
      notify.error(NOTIFY_SEED_SITE_URL_EXAMPLE);
      return;
    }
    const FILL_KW_LOADING_ID = "local-analysis-fill-kw";
    /** Reuse one WordPress post library fetch when keyword fill and strategy both need it. */
    let sharedWpPostInventory: Awaited<ReturnType<typeof ensureBulkGenerationWpInventory>> | null = null;

    let rowsForRun = targetsOverride ?? keywordTargets;
    let { targets, total } = normalizeKeywordTargets(rowsForRun);

    if (targets.length === 0) {
      const seedUrl = site.siteUrl?.trim() ?? "";
      const hasWpCreds =
        !isTempWorkspace &&
        Boolean(site.username?.trim() && site.appPassword?.trim() && seedUrl);
      if (!hasWpCreds) {
        notify.error(
          "Add at least one target keyword, or connect WordPress (username + app password) to load your post library.",
        );
        return;
      }
      const emptyRows = rowsForRun.filter((r) => !r.keyword.trim());
      if (emptyRows.length === 0) {
        notify.error(NOTIFY_ADD_AT_LEAST_ONE_TARGET_KEYWORD);
        return;
      }
      try {
        notify.loading(NOTIFY_LOADING_WORDPRESS_POST_LIBRARY, { id: FILL_KW_LOADING_ID });
        setHeaderProgress({
          kind: "generate",
          phase: "Loading WordPress post library…",
          completed: 0,
          total: 0,
        });
        const inv = await ensureBulkGenerationWpInventory(site);
        const inventoryRows = pickEntityGeneratorKeywordInventoryRows(site, inv.rows ?? []);
        if (inv.error) {
          notify.error(inv.error);
          return;
        }
        if (!inventoryRows.length) {
          notify.error(
            "WordPress entity sitemap and post library are empty. Add keywords manually or ensure published entity or post URLs exist.",
          );
          return;
        }
        sharedWpPostInventory = inv;
        notify.loading(NOTIFY_DERIVING_KEYWORDS_FROM_POSTS, { id: FILL_KW_LOADING_ID });
        setHeaderProgress({
          kind: "generate",
          phase: "Deriving keywords from inventory…",
          completed: 0,
          total: emptyRows.length,
        });
        const fills = await fillKeywordsFromWpInventoryPosts({
          apiKey: openRouterKey,
          model: researchModel,
          siteId: site.id,
          siteName: site.name,
          siteUrl: site.siteUrl ?? "",
          posts: inventoryRows,
          rowsToFill: emptyRows.map((r) => ({
            id: r.id,
            entityHint: r.entityHint ?? "",
            sapPages: r.sapPages,
            ...(r.clusterRole ? { clusterRole: r.clusterRole } : {}),
            ...(r.clusterId ? { clusterId: r.clusterId } : {}),
          })),
          temperature,
          topP,
        });
        rowsForRun = rowsForRun.map((r) => {
          const kw = fills.get(r.id);
          return kw ? { ...r, keyword: kw } : r;
        });
        setKeywordTargets(rowsForRun);
        const norm2 = normalizeKeywordTargets(rowsForRun);
        targets = norm2.targets;
        total = norm2.total;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        notify.error(msg || "Could not load post library or derive keywords.");
        return;
      } finally {
        notify.dismiss(FILL_KW_LOADING_ID);
      }
    }

    if (targets.length === 0) {
      notify.error(NOTIFY_ADD_AT_LEAST_ONE_TARGET_KEYWORD);
      return;
    }
    const sapBearing = sapBearingTargetsForAllocation(targets);
    if (sapBearing.length === 0) {
      notify.error(NOTIFY_ADD_SAP_BUDGET_ON_MEMBER_ROWS_OR_A_SINGL);
      return;
    }
    if (total > TOTAL_SAP_CAP) {
      notify.error(notifyTotalSapPagesAcrossTargetsCannotEx(TOTAL_SAP_CAP));
      return;
    }
    let apiTargets = targets;
    let targetSapCount = Math.min(total, maxSapBudget);
    if (total !== maxSapBudget) {
      const repairedSapBearing = repairSapPageAllocation(
        sapBearing.map((t) => ({
          keyword: t.keyword,
          sapPages: t.sapPages,
          ...(t.entityHint ? { entityHint: t.entityHint } : {}),
          ...(t.clusterId ? { clusterId: t.clusterId } : {}),
          ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
        })),
        maxSapBudget,
        LOCAL_ANALYSIS_SAP_MIN,
        LOCAL_ANALYSIS_SAP_MAX,
      );
      apiTargets = mergeRepairedSapBearingIntoTargets(targets, sapBearing, repairedSapBearing);
      targetSapCount = maxSapBudget;
      if (total > maxSapBudget) {
        notify.message(notifySapScaledToXMaxX(targetSapCount, maxSapBudget), { duration: 8_000 });
      }
    }
    const generationTargets = keywordTargetsInGenerationOrder(
      apiTargets.map((t) => ({
        id: t.id,
        keyword: t.keyword,
        entityHint: t.entityHint ?? "",
        sapPages: t.sapPages,
        clusterId: t.clusterId,
        clusterRole: t.clusterRole,
      }))
    );
    const titleTargets = apiTargets.map((t) => ({
      id: t.id,
      keyword: t.keyword,
      entityHint: t.entityHint ?? "",
      sapPages: t.sapPages,
      ...(t.clusterId ? { clusterId: t.clusterId } : {}),
      ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
    }));
    let titleHarnessGroups = buildEntityTitleHarnessGroupsFromTargets(titleTargets, maxSapBudget);
    const plannedEntityCount = titleHarnessGroups.reduce((n, g) => n + g.entities.length, 0);
    let titleClusterJobs = buildEntityTitleClusterJobsFromTargets(titleTargets, maxSapBudget);

    setIsAnalyzing(true);
    setHeaderProgress({
      kind: "generate",
      phase: "Reading master rules…",
      completed: 0,
      total: plannedEntityCount,
      titleHarnessGroups,
      harnessPlannedSectionCount: plannedEntityCount,
    });
    try {
      const needsWpInventory =
        !isTempWorkspace &&
        Boolean(
          site.siteUrl?.trim() &&
            site.username?.trim() &&
            site.appPassword?.trim(),
        );

      notify.loading(NOTIFY_READING_MASTER_RULES, { id: "local-analysis-generate" });
      setHeaderProgress((prev) =>
        mergeEntityGenerateProgress(prev, {
          kind: "generate",
          phase: "Reading master rules…",
          completed: 0,
          total: plannedEntityCount,
        }),
      );
      const [, resolved, invFromParallel] = await Promise.all([
        ensureMasterInstructionsInMemory(isTempWorkspace ? undefined : site.id),
        resolvePrimaryLocationLabel(site).catch(() => null),
        needsWpInventory && !sharedWpPostInventory
          ? ensureBulkGenerationWpInventory(site).catch(() => null)
          : Promise.resolve(sharedWpPostInventory),
      ]);
      if (invFromParallel && !sharedWpPostInventory) {
        sharedWpPostInventory = invFromParallel;
      }

      const resolvedLabel = resolved?.trim();
      const gridMd = gridSummaryMarkdown.trim();
      let entityMarket: string | undefined;
      if (gridMd.length > 0) {
        const fromGrid = defaultSeedEntityHintFromGrid(csvPlaceHints, null).trim();
        entityMarket = fromGrid.length > 0 ? fromGrid : undefined;
      } else {
        entityMarket =
          getPrimaryCityStateLabel(site)?.trim() ||
          resolvedLabel ||
          undefined;
      }
      const focusLocationForSap = suggestFocusLocation.trim();

      let wordpressPostInventory: { title: string; keyword: string }[] | undefined;
      if (sharedWpPostInventory && !sharedWpPostInventory.error) {
        const picked = pickEntityGeneratorKeywordInventoryRows(
          site,
          sharedWpPostInventory.rows ?? [],
        );
        if (picked.length) {
          wordpressPostInventory = mapEntityGeneratorKeywordInventoryPayload(picked);
        }
      }

      notify.loading(NOTIFY_PREPARING_SAP, { id: "local-analysis-generate" });
      setHeaderProgress((prev) =>
        mergeEntityGenerateProgress(prev, {
          kind: "generate",
          phase: "Preparing SAP…",
          completed: 0,
          total: plannedEntityCount,
        }),
      );
      const result = await fetchLocalSeoStrategyFromGrid({
        apiKey: openRouterKey,
        model: researchModel,
        temperature,
        maxTokens,
        topP,
        targetSapCount,
        keywordTargets: keywordTargetsForApi(generationTargets as NormalizedKeywordTarget[]),
        gridSummaryMarkdown: gridSummaryMarkdown.trim() || "",
        manualTargetsOnly: !gridSummaryMarkdown.trim(),
        siteName: site.name,
        siteUrl: site.siteUrl,
        entityLocation: focusLocationForSap || entityMarket,
        siteId: site.id,
        wikipediaSearchAugment: mergedWikipediaSearchAugment,
        /** First OpenRouter completion only — no second pass rewriting keywords/titles. */
        refineSapRowKeywordsWithRag: false,
        // Never treat "one seed row holding all SAP pages" as single-seed mode: that forced the same
        // target keyword onto every row and skipped per-cluster / per-location keyword variation. Cluster
        // prompts + per-row model keywords handle both multi-member clusters and seed-only multi-page runs.
        localAnalysisSingleSeed: false,
        entityGeographicLevel,
        ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
        ...(wordpressPostInventory?.length ? { wordpressPostInventory } : {}),
        ...(clientAudienceContextMarkdown.length > 0 ? { clientAudienceContextMarkdown } : {}),
        ...(granularPoolTitles.length > 0 ? { wikipediaPreferredTitles: granularPoolTitles } : {}),
        ...(placeWeaknessForSuggest.length > 0 ? { gridPlaceWeightsForWiki: placeWeaknessForSuggest } : {}),
        onWikiProgress: (done, total) => {
          notify.loading(notifyWikipediaXX(done, total), { id: "local-analysis-generate" });
          setHeaderProgress((prev) =>
            mergeEntityGenerateProgress(prev, {
              kind: "generate",
              phase: `Wikipedia ${done}/${total}…`,
              completed: done,
              total: plannedEntityCount,
            }),
          );
        },
        onSapGenerateStart: () => {
          notify.loading(NOTIFY_GENERATING_SAP_ROWS, { id: "local-analysis-generate" });
          setHeaderProgress((prev) =>
            mergeEntityGenerateProgress(prev, {
              kind: "generate",
              phase: "Generating SAP rows…",
              completed: 0,
              total: plannedEntityCount,
            }),
          );
        },
      });
      const sapRowsWithOrigin = applySapOriginFromTitleToRows(result.sapRows);
      titleClusterJobs = buildEntityTitleClusterJobs(titleTargets, sapRowsWithOrigin, maxSapBudget);
      titleHarnessGroups = hydrateEntityTitleHarnessFromSapRows(
        titleHarnessGroups,
        titleClusterJobs,
        sapRowsWithOrigin,
      );
      setHeaderProgress((prev) =>
        mergeEntityGenerateProgress(prev, {
          kind: "generate",
          phase: "Generating SAP rows…",
          completed: 0,
          total: plannedEntityCount,
          titleHarnessGroups: [...titleHarnessGroups],
        }),
      );
      const { enriched: sapRowsLinked, wikiByIndex } = await enrichSapRowsWithWikiLinks(
        sapRowsWithOrigin,
        localAnalysisWikiLookupOptions,
        (done, total) => {
          setHeaderProgress((prev) =>
            mergeEntityGenerateProgress(prev, {
              kind: "generate",
              phase: `Generating SAP rows… (${done}/${total} linked)`,
              completed: done,
              total: plannedEntityCount,
            }),
          );
        },
      ).catch((err: unknown) => {
        throw err instanceof Error ? err : new Error(String(err));
      });
      const sapRowsWithPerEntityWiki = sapRowsLinked;
      titleClusterJobs = buildEntityTitleClusterJobs(
        titleTargets,
        sapRowsWithPerEntityWiki,
        maxSapBudget,
      );
      titleHarnessGroups = hydrateEntityTitleHarnessFromSapRows(
        titleHarnessGroups,
        titleClusterJobs,
        sapRowsWithPerEntityWiki,
      );
      setHeaderProgress((prev) =>
        mergeEntityGenerateProgress(prev, {
          kind: "generate",
          phase: "Assigning unique keywords from GSC",
          completed: 0,
          total: plannedEntityCount,
          titleHarnessGroups: [...titleHarnessGroups],
        }),
      );
      const sapRowsWithSlugs = applySapTargetSlugsFromKeywordEntity(sapRowsWithPerEntityWiki);
      const sapRowsWithKeywords = await assignUniqueEntitySapKeywords(sapRowsWithSlugs, titleTargets);
      setHeaderProgress((prev) =>
        mergeEntityGenerateProgress(prev, {
          kind: "generate",
          phase: "Writing titles",
          completed: 0,
          total: plannedEntityCount,
          titleHarnessGroups: [...titleHarnessGroups],
          harnessPlannedSectionCount: plannedEntityCount,
        }),
      );
      const sapRowsTitled = await fillSapRowTitlesFromOpenRouter(sapRowsWithKeywords, {
        apiKey: openRouterKey,
        model: researchModel,
        siteId: isTempWorkspace ? undefined : site.id,
        siteName: site.name,
        gridLocations,
        ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
        onProgress: (done, total) => {
          setHeaderProgress((prev) =>
            mergeEntityGenerateProgress(prev, {
              kind: "generate",
              phase: `Writing titles (${done}/${total})`,
              completed: done,
              total: plannedEntityCount,
              titleHarnessGroups: [...titleHarnessGroups],
              harnessPlannedSectionCount: plannedEntityCount,
            }),
          );
        },
      });
      const sapRowsWithMeta = await fillSapRowMetaFromOpenRouter(sapRowsTitled, {
        apiKey: openRouterKey,
        model: researchModel,
        siteId: isTempWorkspace ? undefined : site.id,
        siteName: businessName.trim() || site.name?.trim() || "Site",
      });
      const committedRows = applySapOriginFromTitleToRows(sapRowsWithMeta);
      if (committedRows.length > 0) {
        setSapRows(finalizeEntitySapRowsForAdGroups(committedRows));
        setEntitySelectedRowIndices(allRowIndicesSet(committedRows.length));
        setWikiBySapRowIndex({ ...wikiByIndex });
        setStrategyMarkdown(result.strategyMarkdown);
        setQuestionsByKeyword(result.questionsByKeyword);
      }
      if (total !== maxSapBudget) {
        setKeywordTargets(
          apiTargets.map((t) => ({
            id: t.id,
            keyword: t.keyword,
            entityHint: t.clusterRole === "member" ? "" : (t.entityHint ?? ""),
            sapPages: t.sapPages,
            ...(t.clusterId ? { clusterId: t.clusterId } : {}),
            ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
          }))
        );
      }
      const suspicious =
        csvPlaceHints.length > 0
          ? sapRowsLinked.filter((r) => !entityMatchesCsvPlaceHints(r.entity, csvPlaceHints))
          : [];
      if (suspicious.length > 0) {
        notify.message(notifyCheckXEntityRowSVsCsv(suspicious.length), { duration: 10_000 });
      }
    } finally {
      notify.dismiss("local-analysis-generate");
      setIsAnalyzing(false);
      setHeaderProgress(null);
    }
  }, [
    gridSummaryMarkdown,
    openRouterKey,
    researchModel,
    temperature,
    maxTokens,
    topP,
    keywordTargets,
    csvPlaceHints,
    site,
    maxSapBudget,
    isTempWorkspace,
    suggestFocusLocation,
    entityGeographicLevel,
    entityTypeFocus,
    mergedWikipediaSearchAugment,
    granularPoolTitles,
    clientAudienceContextMarkdown,
    placeWeaknessForSuggest,
    localAnalysisWikiLookupOptions,
    assignUniqueEntitySapKeywords,
  ]);

  const runSuggestKeywords = useCallback(async () => {
    const raw = sapPageBudgetInput.trim().replace(/[^\d]/g, "");
    if (!/^\d+$/.test(raw)) {
      notify.error(NOTIFY_ENTER_A_WHOLE_NUMBER_FOR_TOTAL_SAP_PAGES);
      return;
    }
    let total = Math.floor(Number(raw));
    if (!Number.isFinite(total) || total < LOCAL_ANALYSIS_SAP_MIN) {
      notify.error(notifyEnterAValidTotalSapPagesValueAtL(LOCAL_ANALYSIS_SAP_MIN));
      return;
    }
    if (total > TOTAL_SAP_CAP) {
      notify.error(notifyTotalSapPagesCannotExceedX(TOTAL_SAP_CAP));
      return;
    }
    total = Math.min(TOTAL_SAP_CAP, total);
    if (!openRouterKey) {
      notify.error(NOTIFY_OPENROUTER_IN_SETTINGS);
      return;
    }
    const seedUrl = site.siteUrl?.trim() ?? "";
    const useWordPressInventory =
      !isTempWorkspace &&
      Boolean(site.username?.trim() && site.appPassword?.trim() && seedUrl);

    const name = businessName.trim() || site.name?.trim() || "";
    const websiteUrl = isTempWorkspace ? workspace.tempSeedUrl.trim() : seedUrl;
    if (!name) {
      notify.error(NOTIFY_CONNECT_A_SITE_WITH_A_BUSINESS_NAME_IN_I);
      return;
    }
    const focusLocOnly = suggestFocusLocation.trim();
    if (!websiteUrl && !focusLocOnly) {
      notify.error(NOTIFY_ENTER_A_WEBSITE_URL_OR_A_FOCUS_LOCATION_);
      return;
    }
    if (isTempWorkspace || !site.username?.trim() || !site.appPassword?.trim() || !seedUrl) {
      notify.error(
        "Connect WordPress (username + app password) to load sitemap inventory and GSC before Clusters.",
      );
      return;
    }
    const hasGridCsv = Boolean(gridCsvFullText.trim());

    const resumeRows = finalizeEntitySapRowsForAdGroups(sapRows.slice(0, total));
    const resumeTitledCount = resumeRows.filter((r) => r.title?.trim()).length;
    const canResumeTitles =
      resumeRows.length > 0 &&
      resumeTitledCount < resumeRows.length &&
      resumeRows.every((r) => r.keyword?.trim() && (r.entity ?? "").trim());

    if (canResumeTitles) {
      setSuggestLoading(true);
      setEntitySelectedRowIndices(allRowIndicesSet(resumeRows.length));
      setHeaderProgress({
        kind: "suggest",
        phase: "Writing titles",
        completed: resumeTitledCount,
        total,
      });
      try {
        const hydrated = await hydrateEntityClusterSapRows({
          apiKey: openRouterKey,
          model: researchModel,
          siteId: isTempWorkspace ? undefined : site.id,
          siteName: name,
          gridLocations,
          rows: resumeRows,
          ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
          onTitleProgress: (done, _titleTotal) => {
            setHeaderProgress({
              kind: "suggest",
              phase: "Writing titles",
              completed: done,
              total,
            });
          },
          onMetaProgress: (done, _metaTotal) => {
            setHeaderProgress({
              kind: "suggest",
              phase: "Writing meta descriptions",
              completed: done,
              total,
            });
          },
          onRowsUpdate: (rows) => {
            setSapRows(rows.map((row) => ({ ...row })));
            setEntitySelectedRowIndices(allRowIndicesSet(rows.length));
          },
        });
        setSapRows(finalizeEntitySapRowsForAdGroups(hydrated));
        setEntitySelectedRowIndices(allRowIndicesSet(hydrated.length));
        notify.success(`Finished ${hydrated.filter((r) => r.title?.trim()).length} SAP titles.`);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Title resume failed";
        notify.error(msg);
        return;
      } finally {
        notify.dismiss("local-analysis-suggest");
        setSuggestLoading(false);
        setHeaderProgress(null);
      }
    }

    setSuggestLoading(true);
    setEntitySelectedRowIndices(new Set());
    const cacheReady = getEntitySiteWarmCacheIfReady(site.id);
    setHeaderProgress({
      kind: "suggest",
      phase: cacheReady ? "Grepping Wiki for locations" : "Loading site inventory and GSC cache",
      completed: 0,
      total: total,
    });
    try {
      const cachedWarm = getEntitySiteWarmCacheIfReady(site.id);
      const warm = cachedWarm ?? (await ensureEntitySiteWarmCache(site));
      if (warm.error) {
        throw new Error(warm.error);
      }
      const inventory = warm.inventory;
      if (inventory.totalRows === 0) {
        throw new Error(
          "WordPress sitemap inventory is empty. Connect the site and ensure Pages, Posts, and SAP sitemaps return URLs.",
        );
      }
      const gscQueries = gscQueriesFromWarmBundleForSapBudget(warm, total);
      const keywordSources: EntitySapKeywordSources = {
        links: inventory.links,
        buckets: inventory.buckets,
        gscQueries,
        gscDateRange: warm.gsc.dateRange,
      };
      commitSitemapInventoryLinks(inventory.links);
      await yieldFrameForDetailsPaint();
      entityKeywordSourcesRef.current = keywordSources;
      commitGscKeywordsHostedLink(websiteUrl, keywordSources.gscQueries, keywordSources.gscDateRange);
      await yieldFrameForDetailsPaint();

      notify.loading(NOTIFY_SUGGESTING_KEYWORDS, { id: "local-analysis-suggest" });

      const metroHint = suggestFocusLocation.trim() || primaryWikiAugmentLabel?.trim() || "";
      let clusterResult: Awaited<ReturnType<typeof runEntityGridLocationClusterAgent>>;

      if (hasGridCsv) {
        const pr = parseLocalDominatorCsv(gridCsvFullText);
        if (pr.error) {
          throw new Error(pr.error);
        }
        if (pr.rows.length === 0) {
          throw new Error("Grid CSV has no data rows.");
        }
        setHeaderProgress({
          kind: "suggest",
          phase: "Clustering grid locations (weakness weights)",
          completed: 0,
          total: total,
        });
        clusterResult = await runEntityGridLocationClusterAgent({
          apiKey: openRouterKey,
          siteId: site.id,
          gridRows: pr.rows,
          gridKeywordWeights,
          gscQueries: keywordSources.gscQueries,
          gridLocations,
          totalSapBudget: total,
          entityGeographicLevel,
          businessName: name,
          siteName: site.name?.trim() || name,
          ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
          onClusterProgress: (_done, _clusterTotal, placeLabel) => {
            setHeaderProgress({
              kind: "suggest",
              phase: placeLabel ? `Cluster: ${placeLabel}` : "Clustering grid locations",
              completed: 0,
              total,
            });
          },
        });
      } else {
        const cachedRows = getBulkGenerationWpInventoryIfReady(site.id);
        const sapInventoryRows = pickEntityGeneratorKeywordInventoryRows(site, cachedRows ?? []);
        if (sapInventoryRows.length === 0) {
          throw new Error(
            "Service area sitemap has no locations. Connect WordPress and ensure the entity sitemap returns URLs.",
          );
        }
        const sitemapBuckets = buildSitemapLocationBucketsFromInventory(sapInventoryRows, metroHint);
        if (sitemapBuckets.length === 0) {
          throw new Error(
            "Could not parse locations from the service area sitemap. Add a focus location or upload a grid CSV.",
          );
        }
        const sitemapLocations = sitemapLocationLabelsFromBuckets(sitemapBuckets);
        setHeaderProgress({
          kind: "suggest",
          phase: "Clustering service area sitemap locations",
          completed: 0,
          total,
        });
        clusterResult = await runEntityLocationClusterFromBuckets({
          apiKey: openRouterKey,
          siteId: site.id,
          buckets: sitemapBuckets,
          gscQueries: keywordSources.gscQueries,
          gridLocations: sitemapLocations,
          totalSapBudget: total,
          entityGeographicLevel,
          businessName: name,
          siteName: site.name?.trim() || name,
          ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
          onClusterProgress: (_done, _clusterTotal, placeLabel) => {
            setHeaderProgress({
              kind: "suggest",
              phase: placeLabel ? `Cluster: ${placeLabel}` : "Clustering service area sitemap locations",
              completed: 0,
              total,
            });
          },
        });
      }
      setSapRows(finalizeEntitySapRowsForAdGroups(clusterResult.sapRows.map((row) => ({ ...row }))));
      setEntitySelectedRowIndices(allRowIndicesSet(clusterResult.sapRows.length));
      setHeaderProgress({
        kind: "suggest",
        phase: "Writing titles",
        completed: 0,
        total,
      });
      const wikiMarkdown = clusterResult.wikiMarkdown;
      const wikiEntityPoolTitles = clusterResult.wikiEntityPoolTitles;
      setGranularPoolTitles(wikiEntityPoolTitles);

      const hydrateClusterPreviewRows = async (
        nextTargets: KeywordTargetRow[],
        clusterWikipedia: GridClusterWikipedia[],
        clusterSapRows: CSVRow[],
      ): Promise<number> => {
        const groupedSapRows = finalizeEntitySapRowsForAdGroups(clusterSapRows.map((row) => ({ ...row })));
        if (groupedSapRows.length === 0) {
          throw new Error("Clusters produced 0 SAP preview rows. Check grid weights and suggest output.");
        }
        const commitSapRows = (rows: CSVRow[]) => {
          setSapRows(rows.map((row) => ({ ...row })));
          setEntitySelectedRowIndices(allRowIndicesSet(rows.length));
        };
        setHeaderProgress({
          kind: "suggest",
          phase: "Assigning unique keywords from GSC",
          completed: 0,
          total,
        });
        const titleTargets = keywordTargetRowsToTitleTargets(nextTargets);
        const seedKeywords = new Array<string>(groupedSapRows.length).fill("");
        const keywordJobs = buildEntityTitleClusterJobsFromTargets(titleTargets, groupedSapRows.length);
        for (const job of keywordJobs) {
          for (const idx of job.rowIndices) {
            if (idx >= 0 && idx < seedKeywords.length) seedKeywords[idx] = job.seedKeyword;
          }
        }
        const siteUrlForFill = isTempWorkspace ? workspace.tempSeedUrl.trim() : (site.siteUrl?.trim() ?? "");
        const withKeywords = await fillEntitySapRowKeywordsFromInventoryAndGsc({
          apiKey: openRouterKey,
          model: researchModel,
          siteId: isTempWorkspace ? undefined : site.id,
          siteName: name,
          siteUrl: siteUrlForFill,
          rows: groupedSapRows,
          seedKeywords,
          buckets: keywordSources.buckets,
          gscQueries: keywordSources.gscQueries,
          gridLocations,
          ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
        });
        commitSapRows(withKeywords);
        setKeywordTargets(nextTargets);
        setHeaderProgress({
          kind: "suggest",
          phase: "Writing titles",
          completed: 0,
          total,
        });
        let hydrated = withKeywords;
        try {
          hydrated = await hydrateEntityClusterSapRows({
            apiKey: openRouterKey,
            model: researchModel,
            siteId: isTempWorkspace ? undefined : site.id,
            siteName: name,
            gridLocations,
            rows: withKeywords,
            ...(entityTypeFocus.length > 0 ? { entityTypeFocus } : {}),
            onTitleProgress: (done, _titleTotal) => {
              setHeaderProgress({
                kind: "suggest",
                phase: "Writing titles",
                completed: done,
                total,
              });
            },
            onMetaProgress: (done, _metaTotal) => {
              setHeaderProgress({
                kind: "suggest",
                phase: "Writing meta descriptions",
                completed: done,
                total,
              });
            },
            onRowsUpdate: commitSapRows,
          });
        } catch {
          /* keep keyword rows when titles/meta hydrate fails */
        }
        if (hydrated.length === 0) {
          throw new Error("Clusters finished with 0 SAP rows after hydrate.");
        }
        const withWiki = applyGridClusterWikipediaToSapRows(hydrated, clusterWikipedia);
        setWikiBySapRowIndex(
          Object.fromEntries(withWiki.map((row, idx) => [idx, sapRowToWikiCellState(row)])),
        );
        commitSapRows(withWiki);
        return withWiki.length;
      };

      if (useWordPressInventory) {
        const cachedRows = getBulkGenerationWpInventoryIfReady(site.id);
        const pickedRows = pickEntityGeneratorKeywordInventoryRows(site, cachedRows ?? []);
        const invCount = entityGeneratorKeywordInventoryCount(cachedRows, inventory.buckets);
        if (invCount.count === 0) {
          throw new Error(
            "WordPress entity sitemap and post inventory are empty. Connect the site and ensure the entity sitemap or posts sitemap returns URLs.",
          );
        }
        if (pickedRows.length) {
          try {
            sessionStorage.setItem(
              localAnalysisInventoryStorageKey(site.id),
              JSON.stringify({
                posts: mapEntityGeneratorKeywordInventoryPayload(pickedRows, 80).map((p) => ({
                  fields: {
                    title: p.title,
                    keyword: p.keyword,
                  },
                })),
              }),
            );
          } catch {
            /* ignore storage quota */
          }
        }
        const nextTargets: KeywordTargetRow[] = clusterResult.suggestedTargets.map((t) => ({
          id: newTargetRowId(),
          keyword: t.keyword,
          entityHint: t.entityHint ?? "",
          sapPages: t.sapPages,
          ...(t.clusterId ? { clusterId: t.clusterId } : {}),
          ...(t.clusterRole ? { clusterRole: t.clusterRole } : {}),
        }));
        const committedCount = await hydrateClusterPreviewRows(
          nextTargets,
          clusterResult.clusterWikipedia,
          clusterResult.sapRows,
        );
        if (committedCount === 0) {
          throw new Error("Clusters finished with 0 SAP rows.");
        }
        const sum = nextTargets.reduce((s, t) => s + t.sapPages, 0);
        notify.success(notifyXTargetsXSapXPosts(nextTargets.length, sum, invCount.count));
        return;
      }

      throw new Error(
        "WordPress credentials and site URL are required for Clusters keyword research.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Suggestion failed";
      notify.error(msg);
    } finally {
      notify.dismiss("local-analysis-suggest");
      setSuggestLoading(false);
      setHeaderProgress(null);
    }
  }, [
    sapPageBudgetInput,
    maxSapBudget,
    site,
    businessName,
    workspace.tempSeedUrl,
    gridKeywordWeights,
    placeWeaknessForSuggest,
    gridSummaryMarkdown,
    gridCsvFullText,
    csvPlaceHints,
    openRouterKey,
    researchModel,
    isTempWorkspace,
    suggestFocusKeyword,
    suggestFocusLocation,
    entityGeographicLevel,
    entityTypeFocus,
    clientAudienceContextMarkdown,
    commitSitemapInventoryLinks,
    commitGscKeywordsHostedLink,
    gridLocations,
    primaryWikiAugmentLabel,
  ]);

  const hasSapRowsForCsv = sapRows.length > 0;

  const downloadHeaderTargetsCsv = useCallback(() => {
    downloadLocalAnalysisBulkCsv(sapRows.slice(0, maxSapBudget), `entity-${site.name}`, {
      marketHint: suggestFocusLocation.trim() || undefined,
    });
  }, [sapRows, maxSapBudget, site.name, suggestFocusLocation]);

  const updateSapRowAt = useCallback((globalIdx: number, patch: Partial<CSVRow>) => {
    setSapRows((prev) => {
      if (globalIdx < 0 || globalIdx >= prev.length) return prev;
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], ...patch };
      return next;
    });
  }, []);

  const updateEntitySlotRowAt = useCallback((globalIdx: number, patch: Partial<CSVRow>) => {
    setEntitySlotRows((prev) => {
      if (globalIdx < 0 || globalIdx >= prev.length) return prev;
      const next = [...prev];
      next[globalIdx] = { ...next[globalIdx], ...patch };
      return next;
    });
  }, []);

  const displaySapRows = useMemo(
    () => sapRows.slice(0, maxSapBudget),
    [sapRows, maxSapBudget],
  );

  const hasGeneratedSapRows = displaySapRows.length > 0;
  const entityListRows = hasGeneratedSapRows ? displaySapRows : entitySlotRows;
  const entityHasEmptyKeywordRow = entityListRows.some((r) => !r.keyword?.trim());
  /** Idle track off when placeholders/empty keywords remain; active run still shows bar. */
  const hideIdleProgressTrack =
    !headerProgress && (!hasGeneratedSapRows || entityHasEmptyKeywordRow);

  /** Pre-Clusters: pad/trim editable slots to match amount; stamp city only when not Neighbourhoods. */
  useEffect(() => {
    if (sapRows.length > 0) return;
    const wantsNh = entityTypeFocusWantsNeighbourhoods(entityTypeFocus);
    const city = wantsNh
      ? ""
      : resolveSafeCityEntityLabel({
          suggestFocusLocation: suggestFocusLocation.trim() || undefined,
          site,
          gridCityLabels: (() => {
            const t = gridCsvFullText.trim();
            if (!t) return [];
            const parsed = parseLocalDominatorCsv(t);
            if (parsed.error || parsed.rows.length === 0) return [];
            return extractTopPlaceHintsFromRows(parsed.rows, 8);
          })(),
        });
    setEntitySlotRows((prev) => {
      const synced = syncPromptBlogRowsToCount(prev, maxSapBudget);
      if (wantsNh) {
        return synced.map((r) =>
          r.entity && isCityLevelOnlyEntity(r.entity, null) ? { ...r, entity: undefined } : r,
        );
      }
      if (!city) return synced;
      return synced.map((r) =>
        isBadPreloadEntityLabel(r.entity) ? { ...r, entity: city } : r,
      );
    });
  }, [
    maxSapBudget,
    sapRows.length,
    suggestFocusLocation,
    site,
    gridCsvFullText,
    entityTypeFocus,
  ]);

  /** Pre-Clusters: fill blank Keyword + matching place entities (debounced). */
  useEffect(() => {
    if (sapRows.length > 0) return;
    if (!site.siteUrl?.trim()) return;
    const gen = ++entitySlotFillGenRef.current;
    const t = window.setTimeout(() => {
      void (async () => {
        const rows = entitySlotRowsRef.current;
        if (rows.length === 0) return;
        const next = await refreshEntityPreloadSlotKeywords(site, rows, {
          businessName: businessName.trim() || undefined,
          apiKey: openRouterKey,
          model: researchModel,
          suggestFocusLocation: suggestFocusLocation.trim() || undefined,
          entityTypeFocus,
          gridCsvText: gridCsvFullText,
        });
        if (gen !== entitySlotFillGenRef.current) return;
        setEntitySlotRows(next);
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [
    maxSapBudget,
    sapRows.length,
    site.id,
    site.siteUrl,
    site.name,
    businessName,
    openRouterKey,
    researchModel,
    suggestFocusLocation,
    entityTypeFocus,
    gridCsvFullText,
    uploadLabel,
  ]);

  const downloadLocalMarkdownFile = useCallback((content: string, baseName: string) => {
    const safe = baseName.replace(/[^\w-]+/g, "-").slice(0, 80) || "export";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className={cn(SEO_WORKSPACE_INNER_CLASS, "local-analysis-panel")}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
      <SapGeneratorWorkspaceHeader
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        workspace={workspace}
        workspaceBusy={workspaceBusy}
        progressSnapshot={progressSnapshot}
        hideIdleProgressTrack={hideIdleProgressTrack}
        canOpenDetails={canOpenDetails}
        isProcessing={workspaceBusy}
        csvParsing={csvParsing}
        uploadLabel={uploadLabel}
        sapPageBudgetInput={sapPageBudgetInput}
        onSapPageBudgetInputChange={setSapPageBudgetInput}
        suggestFocusKeyword={suggestFocusKeyword}
        onSuggestFocusKeywordChange={setSuggestFocusKeyword}
        suggestFocusLocation={suggestFocusLocation}
        onSuggestFocusLocationChange={setSuggestFocusLocation}
        runLoading={clustersRunLoading}
        onPickFile={onPickFile}
        onRunClusters={() => void runSuggestKeywords()}
        onClear={clearLocalAnalysis}
        entityGeographicLevel={entityGeographicLevel}
        entityTypeFocus={entityTypeFocus}
        onEntityTypeFocusChange={setEntityTypeFocus}
        hasSapRowsForCsv={hasSapRowsForCsv}
        onDownloadTargetsCsv={() => void downloadHeaderTargetsCsv()}
        detailsProps={{
          headerProgress,
          uploadLabel,
          keywordTargetCount: keywordTargets.filter((r) => r.keyword.trim()).length,
          sapRowCount: sapRows.length,
          entityGeographicLevel,
          entityTypeFocus,
          gridSummaryMarkdown,
          strategyMarkdown,
          hasSapRowsForCsv,
          sitemapInventoryLinks,
          gscHostedLink: gscKeywordsHostedLink,
          onDownloadTargetsCsv: () => void downloadHeaderTargetsCsv(),
          onDownloadStrategyMarkdown: () =>
            downloadLocalMarkdownFile(strategyMarkdown, `local-grid-strategy-${site.name}`),
        }}
      />
      </div>

      <div
        className={cn(
          SEO_WORKSPACE_BODY_SCROLL_CLASS,
          "flex w-full min-w-0 flex-col",
          entityListRows.length === 0 && "overflow-y-hidden",
        )}
      >
        <BulkEntityWorkspaceBody
          hasGeneratedSapRows={hasGeneratedSapRows}
          generatedRows={entityListRows}
          selectedRowIndices={entitySelectedRowIndices}
          setSelectedRowIndices={setEntitySelectedRowIndices}
          isGenerating={isAnalyzing}
          isProcessing={workspaceBusy}
          onRowChange={hasGeneratedSapRows ? updateSapRowAt : updateEntitySlotRowAt}
          directionsSiteName={businessName.trim() || site.name?.trim() || ""}
        />
      </div>
    </div>
  );
};
