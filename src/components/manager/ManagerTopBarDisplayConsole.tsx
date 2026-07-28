import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, ChevronDown, Download, Power, RefreshCw, RotateCcw } from "lucide-react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ManagerNotificationLogSegment } from "@/components/manager/ManagerNotificationLogSegment";
import {
  MANAGER_DISPLAY_CONSOLE_ROW,
  MANAGER_DISPLAY_DROPDOWN_PANEL,
  MANAGER_DISPLAY_NAME_BAND,
  MANAGER_DISPLAY_NAME_BAND_WARMING,
  MANAGER_DISPLAY_NAME_CHEVRON_SLOT,
  MANAGER_DISPLAY_NAME_LABEL,
  MANAGER_DISPLAY_SITE_WARMING,
  MANAGER_DISPLAY_SQUARE_BASE,
  MANAGER_DISPLAY_SQUARE_POWER,
  MANAGER_DISPLAY_SQUARE_POWER_WARMING,
  MANAGER_HEADER_BADGE_SIZE,
  managerDisplayKbSquareClass,
  managerDisplayResetSquareClass,
} from "@/components/manager/manager-header-chip-styles";
import {
  MANAGER_NAV_DROPDOWN_ITEM_BASE,
  managerNavDropdownRowClass,
} from "@/components/manager/manager-top-bar-nav-styles";
import { cn } from "@/lib/utils";
import type { WordPressSite } from "@/components/integrations/types";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import { useSitePrefetchState } from "@/hooks/use-site-prefetch-state";
import {
  getEntitySiteWarmCacheIfReady,
  refreshSitePrefetch,
  warmEntitySiteCache,
} from "@/lib/local-analysis/entity-site-warm-cache";
import { htmlToMarkdown } from "@/lib/wordpress-converter";

const POWER_PX = 36;
const SQUARE_PX = 36;

function SiteConsoleFace({ site, isWarming }: { site: WordPressSite; isWarming: boolean }) {
  const label = wordpressSiteDisplayName(site);
  return (
    <span className="flex h-9 w-full min-w-0 shrink-0 items-stretch overflow-visible">
      <span
        className={cn(
          MANAGER_DISPLAY_SQUARE_BASE,
          isWarming ? MANAGER_DISPLAY_SQUARE_POWER_WARMING : MANAGER_DISPLAY_SQUARE_POWER,
        )}
        aria-hidden
      >
        <Power className="h-4 w-4 shrink-0 text-black" />
      </span>
      <span
        className={cn(
          MANAGER_DISPLAY_NAME_BAND,
          "min-w-0 flex-1",
          isWarming && MANAGER_DISPLAY_NAME_BAND_WARMING,
        )}
      >
        <span className={MANAGER_DISPLAY_NAME_LABEL}>{label}</span>
        <span className={MANAGER_DISPLAY_NAME_CHEVRON_SLOT} aria-hidden>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </span>
      </span>
    </span>
  );
}

function csvCell(value: unknown): string {
  const text =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadSitePrefetchBundle(site: WordPressSite): boolean {
  const bundle = getEntitySiteWarmCacheIfReady(site.id);
  if (!bundle) return false;
  const safeSite = wordpressSiteDisplayName(site)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "site";
  const stamp = new Date(bundle.fetchedAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const rows = (bundle.bulkInventoryRows ?? []).map((row) => {
    const rawContent = String(row.fields?.content ?? "");
    // WP REST only returns HTML; CSV content column is simple markdown (same path as Content Opt).
    const contentMd = rawContent.trim() ? htmlToMarkdown(rawContent) : "";
    return {
      collection: row.collection ?? "",
      url: row.url ?? "",
      id: row.id ?? "",
      slug: row.slug ?? "",
      title: row.fields?.title ?? "",
      meta: row.fields?.meta ?? "",
      keyword: row.fields?.keyword ?? "",
      excerpt: row.fields?.excerpt ?? "",
      pageHeading: row.fields?.pageHeading ?? "",
      content: contentMd,
      date_gmt: row.date_gmt ?? "",
      seo_research:
        row.acf && typeof row.acf === "object" && typeof row.acf.seo_research === "string"
          ? row.acf.seo_research
          : "",
      keyword_focus:
        row.acf && typeof row.acf === "object" && typeof row.acf.keyword_focus === "string"
          ? row.acf.keyword_focus
          : "",
      date_modifier:
        row.acf && typeof row.acf === "object" && typeof row.acf.date_modifier === "string"
          ? row.acf.date_modifier
          : "",
      faq:
        row.acf && typeof row.acf === "object" && typeof row.acf.faq === "string"
          ? row.acf.faq
          : "",
    };
  });
  const header = [
    "collection",
    "url",
    "id",
    "slug",
    "title",
    "meta",
    "keyword",
    "excerpt",
    "pageHeading",
    "content",
    "date_gmt",
    "seo_research",
    "keyword_focus",
    "date_modifier",
    "faq",
  ];
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvCell(row[key as keyof typeof row])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeSite}-site-cache-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

export function ManagerTopBarDisplayConsole({
  variant,
  managerTab,
  onManagerTabChange,
  onResetWorkspace,
  showReset,
}: {
  variant: "embedded" | "compact";
  managerTab: string;
  onManagerTabChange: (tab: string) => void;
  onResetWorkspace?: () => void;
  showReset: boolean;
}) {
  const { sites, handleConnectSite } = useWordPressSites();
  const { activeWordPressSiteId, setActiveWordPressSiteId } = useActiveWordPressSite();
  const measureRef = useRef<HTMLDivElement>(null);
  const [siteMenuWidthPx, setSiteMenuWidthPx] = useState(0);

  const displayLabels = useMemo(() => sites.map((s) => wordpressSiteDisplayName(s)), [sites]);
  const activeSite = sites.find((s) => s.id === activeWordPressSiteId);
  const { loading: isSiteWarmLoading, fetchedAt, isStale, refreshing } = useSitePrefetchState(
    activeSite?.id,
  );
  const otherSites = useMemo(
    () => (activeSite ? sites.filter((s) => s.id !== activeSite.id) : sites),
    [sites, activeSite],
  );
  const activeSitePrefetch = activeSite ? getEntitySiteWarmCacheIfReady(activeSite.id) : null;

  useLayoutEffect(() => {
    if (!activeSite) return;
    warmEntitySiteCache(activeSite);
  }, [activeSite?.id, activeSite?.siteUrl, activeSite?.username, activeSite?.appPassword]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    let maxLabel = 0;
    let maxRow = 0;
    for (const el of Array.from(root.children)) {
      const row = el as HTMLElement;
      if (row.dataset.measure === "row") {
        maxRow = Math.max(maxRow, row.offsetWidth);
      } else {
        maxLabel = Math.max(maxLabel, row.offsetWidth);
      }
    }
    const fromLabel = maxLabel > 0 ? POWER_PX + maxLabel + 28 : 0;
    const fromRow = maxRow > 0 ? maxRow : 0;
    setSiteMenuWidthPx(Math.max(fromLabel, fromRow));
  }, [displayLabels]);

  const utilitySquareCount = 2 + (showReset && onResetWorkspace ? 1 : 0);
  const consoleWidthPx =
    siteMenuWidthPx > 0 ? siteMenuWidthPx + SQUARE_PX * utilitySquareCount : undefined;

  const siteMenuWidthStyle: CSSProperties | undefined =
    siteMenuWidthPx > 0 ? { width: siteMenuWidthPx, minWidth: siteMenuWidthPx } : undefined;
  const consoleWidthStyle: CSSProperties | undefined =
    consoleWidthPx !== undefined ? { width: consoleWidthPx, minWidth: consoleWidthPx } : undefined;

  const dropdownAnimateClass =
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 duration-200";

  const dropdownItemClass = (index: number) =>
    variant === "embedded"
      ? cn(MANAGER_NAV_DROPDOWN_ITEM_BASE, managerNavDropdownRowClass(index, false))
      : "cursor-pointer rounded-none px-3 py-2.5 text-base font-normal outline-none focus:bg-zinc-800/90 data-[highlighted]:bg-zinc-800/90";

  const triggerHoverClass =
    variant === "embedded"
      ? "rounded-none hover:bg-zinc-800 data-[state=open]:bg-zinc-800"
      : "hover:bg-zinc-800 data-[state=open]:bg-zinc-800";

  return (
    <>
      <div
        ref={measureRef}
        className="pointer-events-none fixed top-0 -left-[10000px] opacity-0"
        aria-hidden
      >
        {sites.map((site) => (
          <span key={`label-${site.id}`} className={MANAGER_DISPLAY_NAME_LABEL}>
            {wordpressSiteDisplayName(site)}
          </span>
        ))}
        {sites.map((site) => (
          <div
            key={`row-${site.id}`}
            data-measure="row"
            className="inline-flex items-center gap-2.5 px-3"
          >
            <Power className="h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap text-base font-normal leading-tight">
              {wordpressSiteDisplayName(site)}
            </span>
          </div>
        ))}
      </div>
      <div className={MANAGER_DISPLAY_CONSOLE_ROW} style={consoleWidthStyle}>
        {sites.length === 0 || !activeSite ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  MANAGER_HEADER_BADGE_SIZE,
                  MANAGER_DISPLAY_SQUARE_BASE,
                  "bg-black/30 text-muted-foreground opacity-60",
                )}
                aria-label="None connected"
              >
                <Power className="h-4 w-4 shrink-0 text-current" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent>None connected</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                style={siteMenuWidthStyle}
                className={cn(
                  "inline-flex h-9 shrink-0 cursor-pointer items-stretch overflow-visible border-0 bg-transparent p-0 text-left shadow-none outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:ring-offset-0",
                  triggerHoverClass,
                  isSiteWarmLoading && MANAGER_DISPLAY_SITE_WARMING,
                )}
                aria-label={`Connected site: ${wordpressSiteDisplayName(activeSite)}${isSiteWarmLoading ? " (loading site data)" : ""}`}
                aria-haspopup="menu"
              >
                <SiteConsoleFace site={activeSite} isWarming={isSiteWarmLoading} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              style={siteMenuWidthStyle}
              className={cn(MANAGER_DISPLAY_DROPDOWN_PANEL, dropdownAnimateClass)}
            >
              <DropdownMenuItem
                className={cn(dropdownItemClass(0), "shrink-0")}
                onSelect={() => {
                  if (activeSite) void refreshSitePrefetch(activeSite);
                }}
              >
                <div className="flex w-full shrink-0 items-center gap-2.5">
                  <RefreshCw
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground",
                      refreshing && "animate-spin",
                    )}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap text-base font-normal leading-tight">
                    Refresh site data
                    {fetchedAt
                      ? ` · ${new Date(fetchedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}${isStale ? " (stale)" : ""}`
                      : ""}
                  </span>
                </div>
              </DropdownMenuItem>
              {activeSitePrefetch ? (
                <DropdownMenuItem
                  className={cn(dropdownItemClass(1), "shrink-0")}
                  onSelect={() => {
                    if (activeSite) downloadSitePrefetchBundle(activeSite);
                  }}
                >
                  <div className="flex w-full shrink-0 items-center gap-2.5">
                    <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="whitespace-nowrap text-base font-normal leading-tight">
                      Download site cache CSV · {activeSitePrefetch.counts.inventoryTotal.toLocaleString()} URLs
                    </span>
                  </div>
                </DropdownMenuItem>
              ) : null}
              {otherSites.map((site, index) => {
                const label = wordpressSiteDisplayName(site);
                return (
                  <DropdownMenuItem
                    key={site.id}
                    className={cn(dropdownItemClass(index + (activeSitePrefetch ? 2 : 1)), "shrink-0")}
                    onSelect={() => {
                      handleConnectSite(site);
                      setActiveWordPressSiteId(site.id);
                    }}
                  >
                    <div className="flex w-full shrink-0 items-center gap-2.5">
                      <Power className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="whitespace-nowrap text-base font-normal leading-tight">{label}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ManagerNotificationLogSegment
          variant={variant}
          dropdownAnimateClass={dropdownAnimateClass}
        />
        <button
          type="button"
          className={managerDisplayKbSquareClass(managerTab === "knowledge")}
          onClick={() => onManagerTabChange("knowledge")}
          aria-label="Knowledge Base"
          title="Knowledge Base"
        >
          <BookOpen className="shrink-0" />
        </button>
        {showReset && onResetWorkspace ? (
          <button
            type="button"
            className={managerDisplayResetSquareClass()}
            onClick={onResetWorkspace}
            aria-label="Reset all"
            title="Reset all"
          >
            <RotateCcw className="shrink-0" />
          </button>
        ) : null}
      </div>
    </>
  );
}

/** @deprecated Use ManagerTopBarDisplayConsole */
export const ManagerTopBarSiteStrip = ManagerTopBarDisplayConsole;
