import React from "react";
import { FileText, MapPin, PiggyBank, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CompactWordPressTile } from "./CompactWordPressTile";
import type { WordPressSite } from "../types";
import { getEditorialCountsRange, parseQuarterLabelToQuarterYear } from "@/lib/quarter-bounds";
import type { OptimizationActivityTileStats, QuarterEditorialTileStats } from "@/lib/wordpress-api/types";
import { OPTIMIZATION_TILE_COUNTS_ENABLED } from "@/lib/wordpress-optimization-tile-counts";
import { optimizationPeriodCapForPackage } from "@/lib/wordpress-optimization-package";
import type { WordPressPropertyRowDisplay } from "@/lib/wordpress-properties-row-display";
import {
  PROPERTIES_EMPTY,
  PROPERTIES_LIST_STACK,
  propertiesRowOuterClass,
} from "./wordpress-properties-surfaces";
import { isEntitySitemapDisabled } from "@/lib/entity-endpoint-extractor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPropertyListRowBlackMetricFrameClass } from "./cyberpunk-theme";

function nextEditorialPeriodTooltipText(isoExclusiveEnd: string): string {
  const boundary = new Date(isoExclusiveEnd);
  const d = boundary.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `Next editorial period starts ${d}. Plan a full republish for the new window.`;
}

function siteHasWpCredentials(site: WordPressSite): boolean {
  return Boolean(site.siteUrl?.trim() && site.username?.trim() && site.appPassword?.trim());
}

/** Before the hook fills state, keep the tile skeleton in a loading state. */
function optimizationStatsForSite(
  site: WordPressSite,
  optimizationStatsBySite: Record<string, OptimizationActivityTileStats> | undefined,
): OptimizationActivityTileStats | undefined {
  if (!OPTIMIZATION_TILE_COUNTS_ENABLED) return undefined;
  if (!siteHasWpCredentials(site)) return undefined;
  const cap = optimizationPeriodCapForPackage(site.optimizationPackage);
  if (!cap) return undefined;
  const found = optimizationStatsBySite?.[site.id];
  if (found) return found;
  const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
  return {
    quarterLabel: range.quarterLabel,
    loading: true,
    totalOptimized: null,
    cap,
    remaining: null,
    countsPeriodAfterIso: range.after,
    countsPeriodEndExclusiveIso: range.before,
    countsPeriodMode: range.mode,
  };
}

function quarterStatsForSite(
  site: WordPressSite,
  quarterStatsBySite: Record<string, QuarterEditorialTileStats> | undefined,
): QuarterEditorialTileStats | undefined {
  if (!siteHasWpCredentials(site)) return undefined;
  const found = quarterStatsBySite?.[site.id];
  if (found) return found;
  const range = getEditorialCountsRange(site.editorialCountsPeriodStartYmd, new Date());
  const sitemapDisabled = isEntitySitemapDisabled(site);
  const entityUrlActive = sitemapDisabled ? "" : site.entitySitemapUrl?.trim() ?? "";
  return {
    quarterLabel: range.quarterLabel,
    loading: true,
    postsLive: null,
    postsScheduled: null,
    entityLive: null,
    entityScheduled: null,
    entityConfigured: Boolean(site.manualEndpoint?.trim() || entityUrlActive),
    entityCountsAvailable: false,
    countsPeriodAfterIso: range.after,
    countsPeriodEndExclusiveIso: range.before,
    countsPeriodMode: range.mode,
  };
}

/** Metric cells in a row; flush black bar, no gaps between count frames. */
const PROPERTY_METRICS_CLUSTER_CLASS = "inline-flex shrink-0 items-stretch gap-0";

/** Fixed width for 2-digit counts so columns align across rows. */
const PROPERTY_METRIC_COUNT_SLOT_CLASS =
  "inline-block min-w-[1.5rem] text-center tabular-nums";

function propertyMetricCellClass(compact: boolean): string {
  return getPropertyListRowBlackMetricFrameClass(compact);
}

function propertyMetricCellWidths(rowDisplay: WordPressPropertyRowDisplay) {
  const c = rowDisplay === "compact";
  return {
    post: c ? "min-w-[4rem] w-[4rem]" : "min-w-[4.5rem] w-[4.5rem]",
    sap: c ? "min-w-[4rem] w-[4rem]" : "min-w-[4.5rem] w-[4.5rem]",
    opt: c ? "min-w-[6.5rem] w-[6.5rem]" : "min-w-[7rem] w-[7rem]",
    q: c ? "min-w-[2.5rem] w-[2.5rem]" : "min-w-[3rem] w-[3rem]",
    posts: c ? "min-w-[3.75rem] w-[3.75rem]" : "min-w-[4.25rem] w-[4.25rem]",
    ent: c ? "min-w-[3.75rem] w-[3.75rem]" : "min-w-[4.25rem] w-[4.25rem]",
  };
}

function quarterPairTotalForStrip(
  a: number | null,
  b: number | null,
  loading: boolean,
): number | null {
  if (typeof a === "number" && Number.isFinite(a) && typeof b === "number" && Number.isFinite(b)) {
    return a + b;
  }
  if (loading) return null;
  if (a === null || b === null) return null;
  return a + b;
}

function formatQuarterCountCell(n: number | null, loading: boolean): string {
  void loading;
  if (typeof n === "number" && Number.isFinite(n)) return String(n);
  return "0";
}

function quarterStripTooltip(stats: QuarterEditorialTileStats, postsLoading?: boolean): string {
  const postL = postsLoading ?? stats.loading;
  const postsTotal = quarterPairTotalForStrip(stats.postsLive, stats.postsScheduled, postL);
  const entitiesTotal =
    stats.entityConfigured && stats.entityCountsAvailable
      ? quarterPairTotalForStrip(stats.entityLive, stats.entityScheduled, stats.loading)
      : null;
  const parsed = parseQuarterLabelToQuarterYear(stats.quarterLabel.trim());
  const qShort = parsed ? `Q${parsed.quarter}` : stats.quarterLabel.replace(/\s+\d{4}\b/, "").trim();
  let line = `${qShort}: ${formatQuarterCountCell(postsTotal, postL)} posts`;
  if (stats.entityConfigured && stats.entityCountsAvailable) {
    line += `, ${formatQuarterCountCell(entitiesTotal, stats.loading)} entities`;
  }
  return stats.errorTitle ? `${stats.errorTitle}. ${line}` : line;
}

function QuarterEditorialCountsStrip({
  site,
  stats,
  rowDisplay = "compact",
}: {
  site: WordPressSite;
  stats: QuarterEditorialTileStats | undefined;
  rowDisplay?: WordPressPropertyRowDisplay;
}) {
  if (!siteHasWpCredentials(site) || !stats) return null;

  const hasManualEndpoint = Boolean(site.manualEndpoint?.trim());
  const sitemapDisabled = isEntitySitemapDisabled(site) && !hasManualEndpoint;
  const showEntityCount = !sitemapDisabled && stats.entityConfigured && stats.entityCountsAvailable;

  const postsDisplayLoading =
    stats.loading && (stats.postsLive === null || stats.postsScheduled === null);
  const loading = stats.loading;
  const postsTotal = quarterPairTotalForStrip(
    stats.postsLive,
    stats.postsScheduled,
    postsDisplayLoading,
  );
  const entitiesTotal = showEntityCount
    ? quarterPairTotalForStrip(stats.entityLive, stats.entityScheduled, loading)
    : null;
  const parsed = parseQuarterLabelToQuarterYear(stats.quarterLabel.trim());
  const qShort = parsed ? `Q${parsed.quarter}` : stats.quarterLabel.replace(/\s+\d{4}\b/, "").trim();

  const compact = rowDisplay === "compact";
  const mw = propertyMetricCellWidths(rowDisplay);
  const metricCell = propertyMetricCellClass(compact);
  const iconClass = cn("shrink-0 text-green-400", compact ? "h-4 w-4" : "h-5 w-5");
  const postsCountClass = cn(
    PROPERTY_METRIC_COUNT_SLOT_CLASS,
    "shrink-0 font-light tracking-tight text-green-100",
    compact ? "text-lg leading-none" : "text-xl leading-none",
  );
  const entityIconClass = cn("shrink-0 text-green-400", compact ? "h-4 w-4" : "h-5 w-5");
  const entityCountClass = cn(
    PROPERTY_METRIC_COUNT_SLOT_CLASS,
    "shrink-0 font-light tracking-tight text-green-100",
    compact ? "text-lg leading-none" : "text-xl leading-none",
  );

  const stripSummaryTitle = stats.errorTitle
    ? `${stats.errorTitle}. ${quarterStripTooltip(stats, postsDisplayLoading)}`
    : quarterStripTooltip(stats, postsDisplayLoading);

  const postsTooltipIso = stats.countsPeriodEndExclusiveIso?.trim();
  const postsTooltip = postsTooltipIso ? nextEditorialPeriodTooltipText(postsTooltipIso) : "";

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const postsMetricInner = (
    <span
      className={cn(
        "flex min-w-0 items-center justify-center gap-1 text-green-200",
        postsTooltip && "cursor-default",
      )}
      aria-label={`Posts in period: ${formatQuarterCountCell(postsTotal, postsDisplayLoading)}`}
    >
      <FileText className={iconClass} aria-hidden />
      <span className={postsCountClass}>{formatQuarterCountCell(postsTotal, postsDisplayLoading)}</span>
    </span>
  );

  const postsFramed = (
    <div
      className={cn(metricCell, mw.posts, "text-green-100")}
      title={stripSummaryTitle}
      onClick={stop}
      onPointerDown={stop}
    >
      {postsTooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{postsMetricInner}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-base">
            {postsTooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        postsMetricInner
      )}
    </div>
  );

  const entityDisabledTitle = sitemapDisabled
    ? "Entity sitemap is disabled in the dashboard. Re-enable it in the Sitemap menu to track this count."
    : "Entity counts not configured for this property";

  const entityFramed = showEntityCount ? (
    <div
      className={cn(metricCell, mw.ent, "text-green-100")}
      title={stripSummaryTitle}
      onClick={stop}
      onPointerDown={stop}
      aria-label={`Entities in period: ${formatQuarterCountCell(entitiesTotal, loading)}`}
    >
      <MapPin className={entityIconClass} aria-hidden />
      <span className={entityCountClass}>{formatQuarterCountCell(entitiesTotal, loading)}</span>
    </div>
  ) : (
    <div
      className={cn(
        metricCell,
        mw.ent,
        "text-zinc-500/60 pointer-events-none select-none",
      )}
      title={entityDisabledTitle}
      aria-label={sitemapDisabled ? "Entity sitemap disabled (N/A)" : "Entity counts not configured (N/A)"}
    >
      <span
        className={cn(
          "font-medium tabular-nums tracking-tight text-zinc-500/70",
          compact ? "text-sm leading-none" : "text-base leading-none",
        )}
      >
        N/A
      </span>
    </div>
  );

  return (
    <>
      <div
        className={cn(metricCell, mw.q, "text-green-400")}
        title={stripSummaryTitle}
        onClick={stop}
        onPointerDown={stop}
      >
        <span className={cn("font-medium tabular-nums", compact ? "text-sm" : "text-base")}>{qShort}</span>
      </div>
      {postsFramed}
      {entityFramed}
    </>
  );
}

/** Inner flex for metrics placed inside each black metric cell frame. */
const POST_BANK_STRIP_CLASS =
  "flex h-full w-full min-w-0 items-center justify-center gap-1 tabular-nums text-amber-100/95";

const SAP_BANK_STRIP_CLASS =
  "flex h-full w-full min-w-0 items-center justify-center gap-1 tabular-nums text-yellow-100/95";

const OPT_ACTIVITY_STRIP_CLASS =
  "flex h-full w-full min-w-0 items-center justify-center gap-1.5 tabular-nums text-cyan-100";

function PostBankPendingStrip({
  pending,
  rowDisplay = "compact",
}: {
  pending: number | undefined;
  rowDisplay?: WordPressPropertyRowDisplay;
}) {
  const compact = rowDisplay === "compact";
  const label = pending === undefined ? "0" : String(pending);
  const title =
    pending === undefined
      ? "Loading pending post-type rows…"
      : `Pending post-type rows (client content_bank table when provisioned, else legacy post bank): ${pending}`;
  return (
    <div
      className={cn(POST_BANK_STRIP_CLASS)}
      title={title}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={title}
    >
      <PiggyBank className={cn("shrink-0 text-amber-400", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
      <span
        className={cn(
          PROPERTY_METRIC_COUNT_SLOT_CLASS,
          "shrink-0 font-light tracking-tight text-amber-100/95",
          compact ? "text-lg leading-none" : "text-xl leading-none",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function SapBankPendingStrip({
  pending,
  rowDisplay = "compact",
}: {
  pending: number | undefined;
  rowDisplay?: WordPressPropertyRowDisplay;
}) {
  const compact = rowDisplay === "compact";
  const label = pending === undefined ? "0" : String(pending);
  const title =
    pending === undefined
      ? "Loading pending entity-type rows…"
      : `Pending entity-type rows (client content_bank table when provisioned, else legacy SAP bank): ${pending}`;
  return (
    <div
      className={cn(SAP_BANK_STRIP_CLASS)}
      title={title}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={title}
    >
      <MapPin className={cn("shrink-0 text-yellow-500", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
      <span
        className={cn(
          PROPERTY_METRIC_COUNT_SLOT_CLASS,
          "shrink-0 font-light tracking-tight text-yellow-100/95",
          compact ? "text-lg leading-none" : "text-xl leading-none",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function OptimizationActivityStrip({
  site,
  stats,
  rowDisplay = "compact",
}: {
  site: WordPressSite;
  stats: OptimizationActivityTileStats | undefined;
  rowDisplay?: WordPressPropertyRowDisplay;
}) {
  if (!stats) return null;
  const compact = rowDisplay === "compact";
  const usedForLabel =
    stats.loading && stats.totalOptimized === null
      ? 0
      : stats.totalOptimized ?? 0;
  const label = `${usedForLabel}/${stats.cap}`;
  const remainingForTitle = stats.remaining ?? 0;
  const title = stats.errorTitle
    ? stats.errorTitle
    : `Optimizations this period (${stats.quarterLabel}): published posts and entity CPT (when configured) whose ACF date_modifier falls in this window and is not the same UTC calendar day as the publish date. Remaining: ${remainingForTitle}.`;

  return (
    <div
      className={cn(OPT_ACTIVITY_STRIP_CLASS)}
      title={title}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={title}
    >
      <Sparkles className={cn("shrink-0 text-cyan-400", compact ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
      <span
        className={cn(
          PROPERTY_METRIC_COUNT_SLOT_CLASS,
          "shrink-0 font-light tracking-tight text-cyan-100",
          compact ? "text-lg leading-none" : "text-xl leading-none",
        )}
      >
        {label}
      </span>
    </div>
  );
}

interface WordPressSiteListProps {
  sites: WordPressSite[];
  filteredSites: WordPressSite[];
  siteSearchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProfile: (site: WordPressSite) => void;
  isTesting: string | null;
  isDetecting: string | null;
  isFetchingScheduled: string | null;
  isScrapingSitemap: Record<string, boolean>;
  isIndexingSitemap: Record<string, boolean>;
  isGeneratingEntities?: Record<string, boolean>;
  isExtractingNAPAndGraph: Record<string, boolean>;
  isLoadingCalendar: Record<string, boolean>;
  onTest: (site: WordPressSite) => void;
  onToggleEnabled: (site: WordPressSite) => void;
  onDetect: (site: WordPressSite) => void;
  onEdit: (site: WordPressSite) => void;
  onDelete: (siteId: string) => void;
  onScrapeChildSitemap: (site: WordPressSite, url: string) => void;
  onIndexSitemap: (site: WordPressSite, url: string) => void;
  onEntityGeneration?: (site: WordPressSite, sitemapUrl: string) => void;
  onSetEntitySitemap: (site: WordPressSite, sitemapUrl: string) => void;
  onToggleChildSitemapDisabled: (site: WordPressSite, childSitemapUrl: string) => void;
  onAppendManualChildSitemap: (site: WordPressSite, url: string) => void;
  onLoadCalendarPosts: (site: WordPressSite, sitemapUrl: string) => void;
  onExtractNAPAndGraph: (site: WordPressSite) => void;
  getScrapingKey: (siteId: string, sitemapUrl: string) => string;
  selectedSiteIds?: Set<string>;
  onSelectAll?: (selected: boolean) => void;
  onSiteSelectedChange?: (siteId: string, selected: boolean) => void;
  onDeleteSelected?: () => void;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
  quarterStatsBySite?: Record<string, QuarterEditorialTileStats>;
  optimizationStatsBySite?: Record<string, OptimizationActivityTileStats>;
  /** Visual density for property rows only (local preference). */
  propertyRowDisplay?: WordPressPropertyRowDisplay;
  /** Optional pending post bank row counts keyed by site id (Properties list). */
  postBankPendingBySiteId?: Record<string, number | undefined>;
  /** Optional pending SAP / entity bank row counts keyed by site id (Properties list). */
  sapBankPendingBySiteId?: Record<string, number | undefined>;
}

export const WordPressSiteList: React.FC<WordPressSiteListProps> = ({
  sites,
  filteredSites,
  siteSearchQuery,
  onSearchChange,
  onOpenProfile,
  isTesting,
  isDetecting,
  isFetchingScheduled,
  isScrapingSitemap,
  isIndexingSitemap,
  isGeneratingEntities = {},
  isExtractingNAPAndGraph,
  isLoadingCalendar,
  onTest,
  onToggleEnabled,
  onDetect,
  onEdit,
  onDelete,
  onScrapeChildSitemap,
  onIndexSitemap,
  onEntityGeneration,
  onSetEntitySitemap,
  onToggleChildSitemapDisabled,
  onAppendManualChildSitemap,
  onLoadCalendarPosts,
  onExtractNAPAndGraph,
  getScrapingKey,
  selectedSiteIds,
  onSelectAll,
  onSiteSelectedChange,
  onDeleteSelected,
  onPatchSite,
  quarterStatsBySite,
  optimizationStatsBySite,
  propertyRowDisplay = "compact",
  postBankPendingBySiteId,
  sapBankPendingBySiteId,
}) => {
  const renderPropertyRowTrailingControls = (site: WordPressSite) => {
    const compact = propertyRowDisplay === "compact";
    const mw = propertyMetricCellWidths(propertyRowDisplay);
    const metricCell = propertyMetricCellClass(compact);
    const stop = (e: React.SyntheticEvent) => e.stopPropagation();
    return (
    <div className="flex min-w-0 shrink-0 items-center gap-1">
      <div
        className={PROPERTY_METRICS_CLUSTER_CLASS}
        onClick={stop}
        onPointerDown={stop}
      >
        <div className={cn(metricCell, mw.post)}>
          <PostBankPendingStrip pending={postBankPendingBySiteId?.[site.id]} rowDisplay={propertyRowDisplay} />
        </div>
        <div className={cn(metricCell, mw.sap)}>
          <SapBankPendingStrip pending={sapBankPendingBySiteId?.[site.id]} rowDisplay={propertyRowDisplay} />
        </div>
        {OPTIMIZATION_TILE_COUNTS_ENABLED ? (
          <div className={cn(metricCell, mw.opt)}>
            <OptimizationActivityStrip
              site={site}
              stats={optimizationStatsForSite(site, optimizationStatsBySite)}
              rowDisplay={propertyRowDisplay}
            />
          </div>
        ) : null}
        <QuarterEditorialCountsStrip
          site={site}
          stats={quarterStatsForSite(site, quarterStatsBySite)}
          rowDisplay={propertyRowDisplay}
        />
      </div>
    </div>
    );
  };

  if (sites.length === 0) {
    return (
      <div className="mt-0 flex min-h-0 flex-1 flex-col">
        <div className={PROPERTIES_EMPTY}>
          <p className="text-lg text-zinc-100">No WordPress sites connected</p>
          <p className="mt-2 text-base text-zinc-300">
            Click &quot;Add Site&quot; to connect your first WordPress site
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-0 flex min-h-0 flex-1 flex-col">
      {filteredSites.length === 0 ? (
        <div className={cn(PROPERTIES_EMPTY, "shrink-0 py-8 sm:py-10")}>
          <p className="text-base text-zinc-200">
            No sites found matching &quot;{siteSearchQuery}&quot;
          </p>
        </div>
      ) : (
        <div className="neo-pulse-manager-tab-scroll flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-auto">
        <div className={PROPERTIES_LIST_STACK}>
          {filteredSites.map((site, index) => {
            const rowSelected = selectedSiteIds?.has(site.id) ?? false;

            return (
              <div key={site.id} className="min-w-0 w-full">
                <div
                  className={propertiesRowOuterClass(
                    propertyRowDisplay,
                    index,
                    rowSelected,
                    true,
                  )}
                >
                  {onSiteSelectedChange ? (
                    <div className="flex shrink-0 items-center justify-center pl-0.5">
                      <Checkbox
                        checked={rowSelected}
                        onCheckedChange={(c) => onSiteSelectedChange(site.id, c === true)}
                        className="border-zinc-500/60 data-[state=checked]:border-zinc-500 data-[state=checked]:bg-zinc-800 data-[state=checked]:text-zinc-400"
                        aria-label={`Select ${site.name}`}
                      />
                    </div>
                  ) : null}
                  <div className="flex min-h-0 min-w-0 flex-1 items-center border-0 bg-transparent px-0 py-0">
                    <CompactWordPressTile
                      variant="listRow"
                      site={site}
                      isTesting={isTesting === site.id}
                      isExpanded={false}
                      onToggle={() => onOpenProfile(site)}
                      onTest={() => onTest(site)}
                      onToggleEnabled={() => onToggleEnabled(site)}
                      propertyRowDisplay={propertyRowDisplay}
                      listRowBlackActionChrome
                      onOpenProfile={() => onOpenProfile(site)}
                      onDelete={() => onDelete(site.id)}
                      onApplyDisplayNameFromGmb={
                        onPatchSite ? (name) => onPatchSite(site.id, { name }) : undefined
                      }
                    />
                  </div>
                  <div
                    className={cn(
                      "flex min-w-0 shrink-0 items-center",
                      propertyRowDisplay === "compact" ? "gap-2 sm:gap-2" : "gap-3 sm:gap-4",
                    )}
                  >
                    {renderPropertyRowTrailingControls(site)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
};

export { OptimizationActivityStrip, QuarterEditorialCountsStrip, optimizationStatsForSite, quarterStatsForSite };
