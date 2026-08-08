import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Download, Pencil, Plus, Power, RefreshCw, RotateCcw } from "lucide-react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import { useTeam } from "@/contexts/TeamContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TeamSwitcherPill } from "@/components/manager/TeamSwitcherPill";
import { ManagerDisplayChipFace } from "@/components/manager/ManagerDisplayChipFace";
import { SiteDisplayNameDialog } from "@/components/manager/SiteDisplayNameDialog";
import {
  MANAGER_DISPLAY_CONSOLE_ROW,
  MANAGER_DISPLAY_DROPDOWN_PANEL,
  MANAGER_DISPLAY_NAME_LABEL,
  MANAGER_DISPLAY_SITE_WARMING,
  MANAGER_DISPLAY_SQUARE_BASE,
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

function chipLabelWidthPx(root: HTMLElement, labelMeasure: string): number {
  let maxLabel = 0;
  for (const el of Array.from(root.children)) {
    const row = el as HTMLElement;
    if (row.dataset.measure === labelMeasure) {
      maxLabel = Math.max(maxLabel, row.offsetWidth);
    }
  }
  return maxLabel > 0 ? POWER_PX + maxLabel + 28 : 0;
}

function menuRowWidthPx(root: HTMLElement, rowMeasure: string): number {
  let maxRow = 0;
  for (const el of Array.from(root.children)) {
    const row = el as HTMLElement;
    if (row.dataset.measure === rowMeasure) {
      maxRow = Math.max(maxRow, row.offsetWidth);
    }
  }
  return maxRow;
}

function chipMenuWidthPx(root: HTMLElement, labelMeasure: string, rowMeasure: string): number {
  const fromLabel = chipLabelWidthPx(root, labelMeasure);
  const fromRow = menuRowWidthPx(root, rowMeasure);
  return Math.max(fromLabel, fromRow);
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
  const { sites, handleConnectSite, handlePatchSite } = useWordPressSites();
  const { activeWordPressSiteId, setActiveWordPressSiteId } = useActiveWordPressSite();
  const { teams } = useTeam();
  const measureRef = useRef<HTMLDivElement>(null);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameSite, setRenameSite] = useState<WordPressSite | null>(null);
  const [siteMenuWidthPx, setSiteMenuWidthPx] = useState(0);
  const [teamMenuWidthPx, setTeamMenuWidthPx] = useState(0);
  const [teamDropdownWidthPx, setTeamDropdownWidthPx] = useState(0);

  const displayLabels = useMemo(() => sites.map((s) => wordpressSiteDisplayName(s)), [sites]);
  const teamLabels = useMemo(() => teams.map((t) => t.name), [teams]);
  const activeSite = sites.find((s) => s.id === activeWordPressSiteId);
  const { loading: isSiteWarmLoading, fetchedAt, isStale, refreshing } = useSitePrefetchState(
    activeSite?.id,
  );
  const activeSitePrefetch = activeSite ? getEntitySiteWarmCacheIfReady(activeSite.id) : null;
  const utilityRowCount = 1 + (activeSitePrefetch ? 1 : 0);

  useLayoutEffect(() => {
    if (!activeSite) return;
    warmEntitySiteCache(activeSite);
  }, [activeSite?.id, activeSite?.siteUrl, activeSite?.username, activeSite?.appPassword]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    setSiteMenuWidthPx(chipMenuWidthPx(root, "site-label", "site-row"));
    setTeamMenuWidthPx(chipLabelWidthPx(root, "team-label"));
    setTeamDropdownWidthPx(menuRowWidthPx(root, "team-menu-row"));
  }, [displayLabels, teamLabels]);

  const utilitySquareCount = 2 + (showReset && onResetWorkspace ? 1 : 0);
  const siteChipWidthPx =
    sites.length === 0 || !activeSite ? SQUARE_PX : siteMenuWidthPx > 0 ? siteMenuWidthPx : SQUARE_PX;
  const teamChipWidthPx = teams.length > 0 && teamMenuWidthPx > 0 ? teamMenuWidthPx : 0;
  const consoleWidthPx = teamChipWidthPx + siteChipWidthPx + SQUARE_PX * utilitySquareCount;

  const siteMenuWidthStyle: CSSProperties | undefined =
    siteMenuWidthPx > 0 ? { width: siteMenuWidthPx, minWidth: siteMenuWidthPx } : undefined;
  const teamMenuWidthStyle: CSSProperties | undefined =
    teamMenuWidthPx > 0 ? { width: teamMenuWidthPx, minWidth: teamMenuWidthPx } : undefined;
  const teamDropdownWidthStyle: CSSProperties | undefined =
    teamDropdownWidthPx > 0 ? { width: teamDropdownWidthPx, minWidth: teamDropdownWidthPx } : undefined;
  const consoleWidthStyle: CSSProperties = { width: consoleWidthPx, minWidth: consoleWidthPx };

  const dropdownAnimateClass =
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 duration-200";

  const dropdownItemClass = (index: number, selected = false) =>
    variant === "embedded"
      ? cn(MANAGER_NAV_DROPDOWN_ITEM_BASE, managerNavDropdownRowClass(index, selected))
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
          <span key={`site-label-${site.id}`} data-measure="site-label" className={MANAGER_DISPLAY_NAME_LABEL}>
            {wordpressSiteDisplayName(site)}
          </span>
        ))}
        {teams.map((team) => (
          <span key={`team-label-${team.id}`} data-measure="team-label" className={MANAGER_DISPLAY_NAME_LABEL}>
            {team.name}
          </span>
        ))}
        <div data-measure="team-menu-row" className="inline-flex items-center gap-2.5 px-3">
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap text-base font-normal leading-tight">New agency</span>
        </div>
        {sites.map((site) => (
          <div
            key={`site-row-${site.id}`}
            data-measure="site-row"
            className="inline-flex items-center gap-2.5 px-3"
          >
            <Power className="h-4 w-4 shrink-0" aria-hidden />
            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap text-base font-normal leading-tight">
              {wordpressSiteDisplayName(site)}
            </span>
          </div>
        ))}
      </div>
      <div className={MANAGER_DISPLAY_CONSOLE_ROW} style={consoleWidthStyle}>
        <TeamSwitcherPill
          menuWidthStyle={teamMenuWidthStyle}
          dropdownMenuWidthStyle={teamDropdownWidthStyle}
          dropdownItemClass={dropdownItemClass}
          triggerHoverClass={triggerHoverClass}
          dropdownAnimateClass={dropdownAnimateClass}
        />
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
          <DropdownMenu open={siteMenuOpen} onOpenChange={setSiteMenuOpen}>
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
                <ManagerDisplayChipFace
                  icon={Power}
                  label={wordpressSiteDisplayName(activeSite)}
                  isWarming={isSiteWarmLoading}
                />
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
              {sites.map((site, index) => {
                const selected = site.id === activeSite.id;
                const label = wordpressSiteDisplayName(site);
                const iconClass = selected ? "text-black" : "text-muted-foreground";
                return (
                  <DropdownMenuItem
                    key={site.id}
                    className={cn(dropdownItemClass(utilityRowCount + index, selected), "shrink-0")}
                    onSelect={(event) => {
                      if (selected) {
                        event.preventDefault();
                        return;
                      }
                      handleConnectSite(site);
                      setActiveWordPressSiteId(site.id);
                    }}
                  >
                    <div className="flex w-full shrink-0 items-center gap-2.5">
                      <Power className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
                      <button
                        type="button"
                        aria-label={`Rename ${label}`}
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center",
                          iconClass,
                          "hover:opacity-80",
                        )}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setRenameSite(site);
                          setSiteMenuOpen(false);
                          setRenameDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                      </button>
                      <span className="whitespace-nowrap text-base font-normal leading-tight">{label}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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
      <SiteDisplayNameDialog
        open={renameDialogOpen}
        site={renameSite}
        onOpenChange={(open) => {
          setRenameDialogOpen(open);
          if (!open) setRenameSite(null);
        }}
        onSave={(siteId, name) => {
          const site = sites.find((s) => s.id === siteId);
          if (site && name !== wordpressSiteDisplayName(site)) {
            handlePatchSite(siteId, { name });
          }
        }}
      />
    </>
  );
}

/** @deprecated Use ManagerTopBarDisplayConsole */
export const ManagerTopBarSiteStrip = ManagerTopBarDisplayConsole;
