import React, { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { XCircle, Loader2, Copy, Power, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { loadApiKey } from "@/lib/api";
import { applyGbpPropertyWand } from "@/lib/wordpress-site-display-name-from-dfs-gmb";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import { type WordPressSite } from "../types";
import type { WordPressPropertyRowDisplay } from "@/lib/wordpress-properties-row-display";
import { getCyberpunkCardClasses, getCyberpunkTextClasses, getPropertyListRowBlackIconButtonClass } from "./cyberpunk-theme";

type CopyControlTone = "default" | "white";

interface CompactWordPressTileProps {
  site: WordPressSite;
  isTesting: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onTest?: () => void;
  onToggleEnabled?: () => void;
  /**
   * "card" renders the full tile as a standalone Card (legacy; prefer listRow in lists).
   * "header" is used inside the merged expanded container (no outer Card/border).
   * "menu" is used inside the expanded menu row (single-line title+URL, no connection button).
   * "listRow" is a compact horizontal summary for collapsed list rows (no Card).
   */
  variant?: "card" | "header" | "menu" | "listRow";
  /** List / menu row density only (Integrations Properties). */
  propertyRowDisplay?: WordPressPropertyRowDisplay;
  /** Brighter copy control on dark rows (e.g. multi-site optimizer). */
  copyControlTone?: CopyControlTone;
  /** When set, shows a wand beside Copy to set `site.name` from DataForSEO Business Listings + GBP title. */
  onApplyDisplayNameFromGmb?: (name: string) => void;
  /** `listRow` only: copy + GBP wand use flat black icon chrome (Properties + multi-site). */
  listRowBlackActionChrome?: boolean;
  /** Hide the copy-URL icon (e.g. multi-site Content rows). */
  hideCopyUrl?: boolean;
  /** Site title opens `site.siteUrl` in a new tab instead of plain text. */
  linkTitleToSite?: boolean;
}

function copySiteUrlButton(
  site: WordPressSite,
  compact: boolean | undefined,
  tone: CopyControlTone,
  matchOptimizeRow?: boolean,
) {
  return (
    <button
      type="button"
      aria-label={`Copy site URL: ${site.siteUrl}`}
      title={site.siteUrl}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(site.siteUrl);
      }}
      className={
        matchOptimizeRow
          ? getPropertyListRowBlackIconButtonClass(Boolean(compact))
          : cn(
              "inline-flex shrink-0 items-center justify-center rounded-md shadow-none transition-colors focus-visible:outline-none",
              "border focus-visible:ring-2 focus-visible:ring-offset-0",
              tone === "white"
                ? "border-white/60 bg-transparent text-white hover:border-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-white/50"
                : "border-slate-500/55 bg-slate-900/85 text-slate-200 hover:border-slate-400/70 hover:bg-slate-800/90 hover:text-slate-50 focus-visible:ring-slate-400/45",
              compact ? "p-1" : "p-1.5",
            )
      }
    >
      <Copy
        className={cn(
          "shrink-0",
          matchOptimizeRow ? (compact ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4") : compact ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
        aria-hidden
      />
    </button>
  );
}

/** Single row: copy URL, optional GBP name wand, title. Quarter counts live in the toolbar strip by the gap dropdown. */
function menuInnerSummary(
  site: WordPressSite,
  rowDisplay: WordPressPropertyRowDisplay,
  copyControlTone: CopyControlTone,
  gmbDisplayNameWand: React.ReactNode,
  listRowBlackChrome: boolean,
  options?: { hideCopyUrl?: boolean; linkTitleToSite?: boolean },
) {
  const compact = rowDisplay === "compact";
  const displayName = wordpressSiteDisplayName(site);
  const titleClass = cn(
    "shrink-0 whitespace-nowrap text-base font-bold leading-none",
    getCyberpunkTextClasses("primary"),
  );
  const siteHref = site.siteUrl?.trim()
    ? site.siteUrl.startsWith("http")
      ? site.siteUrl
      : `https://${site.siteUrl}`
    : undefined;

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-nowrap items-center px-0.5 text-left",
        compact ? "gap-2" : "gap-3",
      )}
    >
      {!options?.hideCopyUrl ? copySiteUrlButton(site, compact, copyControlTone, listRowBlackChrome) : null}
      {gmbDisplayNameWand}
      {options?.linkTitleToSite && siteHref ? (
        <a
          href={siteHref}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${siteHref}`}
          className={cn(titleClass, "hover:text-primary hover:underline")}
          onClick={(e) => e.stopPropagation()}
        >
          {displayName}
        </a>
      ) : (
        <h3 className={titleClass} title={displayName}>
          {displayName}
        </h3>
      )}
    </div>
  );
}

export const CompactWordPressTile: React.FC<CompactWordPressTileProps> = ({
  site,
  isTesting,
  isExpanded,
  onToggle,
  onTest,
  onToggleEnabled,
  variant = "card",
  propertyRowDisplay = "compact",
  copyControlTone = "default",
  onApplyDisplayNameFromGmb,
  listRowBlackActionChrome = false,
  hideCopyUrl = false,
  linkTitleToSite = false,
}) => {
  const [isResolvingGmbDisplayName, setIsResolvingGmbDisplayName] = useState(false);

  const handleGmbDisplayNameWand = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onApplyDisplayNameFromGmb || isResolvingGmbDisplayName) return;
      setIsResolvingGmbDisplayName(true);
      try {
        const r = await applyGbpPropertyWand(site, {
          openRouterApiKey: loadApiKey()?.trim() || undefined,
        });
        if (!r.ok) {
          notify.error(r.error);
          return;
        }
        const next = r.name.trim();
        if (next !== site.name.trim()) {
          onApplyDisplayNameFromGmb(next);
        }
      } catch (err) {
        notifyHeaderError("GBP name resolve failed", err);
      } finally {
        setIsResolvingGmbDisplayName(false);
      }
    },
    [isResolvingGmbDisplayName, onApplyDisplayNameFromGmb, site],
  );

  const rowCompact = propertyRowDisplay === "compact";
  const listRowBlackChrome = Boolean(listRowBlackActionChrome && variant === "listRow");
  const gmbDisplayNameWand =
    onApplyDisplayNameFromGmb != null ? (
      <button
        type="button"
        aria-label="Set site name from Google Business Profile (DataForSEO)"
        title="Set site name from Google Business Profile (DataForSEO)"
        disabled={isResolvingGmbDisplayName}
        onClick={(e) => void handleGmbDisplayNameWand(e)}
        className={cn(
          listRowBlackChrome
            ? getPropertyListRowBlackIconButtonClass(rowCompact)
            : "inline-flex shrink-0 items-center justify-center rounded-md border shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
          !listRowBlackChrome &&
            (copyControlTone === "white"
              ? "border-white/60 bg-transparent text-white hover:border-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-white/50"
              : "border-slate-500/55 bg-slate-900/85 text-slate-200 hover:border-slate-400/70 hover:bg-slate-800/90 hover:text-slate-50 focus-visible:ring-slate-400/45"),
          !listRowBlackChrome && (rowCompact ? "p-1" : "p-1.5"),
        )}
      >
        {isResolvingGmbDisplayName ? (
          <Loader2
            className={cn(
              "shrink-0 animate-spin",
              listRowBlackChrome ? (rowCompact ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4") : rowCompact ? "h-3 w-3" : "h-3.5 w-3.5",
            )}
            aria-hidden
          />
        ) : (
          <Wand2
            className={cn(
              "shrink-0",
              listRowBlackChrome ? (rowCompact ? "h-3.5 w-3.5 sm:h-4 sm:w-4" : "h-4 w-4") : rowCompact ? "h-3 w-3" : "h-3.5 w-3.5",
            )}
            aria-hidden
          />
        )}
      </button>
    ) : null;

  const showConnectionButton = !(variant === "header" && isExpanded);
  const isEnabled = site.enabled !== false;
  const isConnected = site.connectionStatus === "success";

  const handleConnectionButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTesting) return;

    if (isConnected && onToggleEnabled) {
      onToggleEnabled();
    } else if (onTest) {
      onTest();
    }
  };

  const powerButton = showConnectionButton ? (
    <button
      type="button"
      onClick={handleConnectionButtonClick}
      disabled={isTesting}
      className={`relative z-10 inline-flex items-center justify-center rounded-full border transition-all ${
        rowCompact ? "h-7 w-7" : "h-8 w-8"
      } ${
        isConnected && isEnabled
          ? "border-green-300/80 bg-green-400/20 text-green-200 shadow-[0_0_8px_rgba(74,222,128,0.4)] hover:bg-green-400/30"
          : site.connectionStatus === "failed"
            ? "border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20"
            : "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
      } ${isTesting ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      title={
        isTesting
          ? "Testing connection..."
          : isConnected
            ? isEnabled
              ? "Click to turn off"
              : "Click to turn on"
            : "Click to test connection"
      }
    >
      {isTesting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-green-300" />
      ) : site.connectionStatus === "failed" ? (
        <XCircle className="h-3.5 w-3.5" />
      ) : (
        <Power className="h-3.5 w-3.5 text-green-400" aria-hidden />
      )}
    </button>
  ) : (
    <div className={cn("shrink-0", rowCompact ? "h-7 w-7" : "h-8 w-8")} aria-hidden />
  );

  const listRowSummaryOptions = { hideCopyUrl, linkTitleToSite };

  const content = (
    <div
      className={cn(
        "flex w-full min-w-0 flex-row items-center",
        rowCompact ? "gap-1.5 sm:gap-2" : "gap-2 sm:gap-3",
      )}
    >
      <div className="min-w-0 flex-1">
        {menuInnerSummary(
          site,
          propertyRowDisplay,
          copyControlTone,
          gmbDisplayNameWand,
          listRowBlackChrome,
          listRowSummaryOptions,
        )}
      </div>
      <div className="flex shrink-0 items-center justify-center">{powerButton}</div>
    </div>
  );

  /** List / menu row: one horizontal summary line (no h-full: breaks flex row height / scroll). */
  const stackedSummaryShell = (
    <div className="flex min-h-0 w-full min-w-0 items-center">
      {menuInnerSummary(
        site,
        propertyRowDisplay,
        copyControlTone,
        gmbDisplayNameWand,
        listRowBlackChrome,
        listRowSummaryOptions,
      )}
    </div>
  );

  if (variant === "listRow") {
    return stackedSummaryShell;
  }

  if (variant === "menu") {
    return stackedSummaryShell;
  }

  if (variant === "header") {
    return (
      <div
        className="w-full cursor-pointer p-4 transition-[padding,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        onClick={onToggle}
      >
        {content}
      </div>
    );
  }

  /** Allow opening the panel for failed/untested sites so users can Edit credentials or Test again. */
  const canOpenDetailPanel =
    isConnected ||
    site.connectionStatus === "failed" ||
    site.connectionStatus === "testing" ||
    site.connectionStatus === undefined;

  return (
    <Card
      title={
        canOpenDetailPanel
          ? undefined
          : "Connect successfully before opening the full property panel"
      }
      className={cn(
        "h-full w-full shrink-0 overflow-hidden rounded-xl border-0 p-4 shadow-none transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0",
        canOpenDetailPanel ? "cursor-pointer" : "cursor-not-allowed",
        getCyberpunkCardClasses(false, true),
        isConnected && isEnabled && !isExpanded && "bg-black/20 hover:bg-black/30",
        !isConnected && "hover:bg-black/20",
        isExpanded && "bg-black/25",
      )}
      onClick={canOpenDetailPanel ? onToggle : undefined}
      role={canOpenDetailPanel ? "button" : undefined}
      tabIndex={canOpenDetailPanel ? 0 : -1}
      onKeyDown={
        canOpenDetailPanel
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      {content}
    </Card>
  );
};
