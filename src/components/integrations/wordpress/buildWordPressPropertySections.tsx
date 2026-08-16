import React from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  FileCode,
  LayoutDashboard,
  Loader2,
  Map,
  PiggyBank,
  ScrollText,
  Settings,
  Server,
} from "lucide-react";
import type { WordPressSite } from "../types";
import { WordPressCardActions } from "./WordPressCardActions";
import { SitemapSection } from "./SitemapSection";
import { getCyberpunkTextClasses } from "./cyberpunk-theme";
import type { WordPressSiteAdminSection } from "./WordPressSiteAdminLayout";
import { openDashboardMasterRulesSettings } from "@/lib/open-master-rules-settings";
import { BankPropertyPanel } from "./BankPropertyPanel";
import { NEO_PULSE_CA_DEPLOY } from "@/lib/neo-pulse-deploy";
import { MasterInstructionsSection } from "./MasterInstructionsSection";
import { FunctionsUpdaterPanel } from "./FunctionsUpdaterPanel";
import { RedirectMatcherPanel } from "./RedirectMatcherPanel";
import { WpEnginePropertyPanel } from "./WpEnginePropertyPanel";

export type BuildWordPressPropertySectionsParams = {
  site: WordPressSite;
  isTesting: boolean;
  isDetecting: boolean;
  isFetchingScheduled: boolean;
  isScrapingSitemap: Record<string, boolean>;
  isGeneratingEntities?: Record<string, boolean>;
  isIndexingSitemap?: Record<string, boolean>;
  isLoadingCalendar?: Record<string, boolean>;
  isExtractingNAPAndGraph?: boolean;
  onTest: () => void;
  onDetect: () => void;
  onScrapeChildSitemap: (childSitemapUrl: string) => void;
  onEntityGeneration?: (sitemapUrl: string) => void;
  onSetEntitySitemap?: (sitemapUrl: string) => void;
  onToggleChildSitemapDisabled?: (childSitemapUrl: string) => void;
  onAppendManualChildSitemap?: (url: string) => void;
  onIndexSitemap?: (sitemapUrl: string) => void;
  onLoadCalendarPosts?: (sitemapUrl: string) => void;
  onExtractNAPAndGraph?: () => void;
  getScrapingKey: (siteId: string, sitemapUrl: string) => string;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
  /** Modal profile or embedded expand panel. */
  shell: "modal" | "embedded" | "card";
  siteSettingsPanel?: React.ReactNode;
};

export function buildWordPressPropertySections(
  params: BuildWordPressPropertySectionsParams,
): WordPressSiteAdminSection[] {
  const {
    site,
    isTesting,
    isDetecting,
    isFetchingScheduled,
    isScrapingSitemap,
    isGeneratingEntities = {},
    isIndexingSitemap = {},
    isLoadingCalendar = {},
    isExtractingNAPAndGraph = false,
    onTest,
    onDetect,
    onScrapeChildSitemap,
    onEntityGeneration,
    onSetEntitySitemap,
    onToggleChildSitemapDisabled,
    onAppendManualChildSitemap,
    onIndexSitemap,
    onLoadCalendarPosts,
    onExtractNAPAndGraph,
    getScrapingKey,
    onPatchSite,
    shell,
    siteSettingsPanel,
  } = params;

  const isModal = shell === "modal";
  const isEmbedded = shell === "embedded";
  const showSitemapSummary = !!site.sitemaps && shell === "card";

  return [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      content: (
        <>
          {showSitemapSummary && (
            <dl className="mt-2 grid grid-cols-2 items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-border/40 bg-muted/40 px-2.5 py-1.5 text-sm text-foreground shadow-none ring-0 sm:px-3 sm:py-2">
              <dt className="font-medium text-muted-foreground">Sitemap</dt>
              <dd className="m-0 flex min-w-0 flex-wrap items-baseline gap-x-1">
                {site.sitemaps?.type === "index" ? (
                  <>
                    <span className="inline-block min-w-[3ch] text-right font-semibold tabular-nums text-foreground">
                      {site.sitemaps?.childSitemaps?.length || 0}
                    </span>
                    <span className="font-semibold text-foreground">Child Sitemaps</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block min-w-[3ch] text-right font-semibold tabular-nums text-foreground">
                      {site.sitemaps?.urls?.length || 0}
                    </span>
                    <span className="font-semibold text-foreground">URLs</span>
                  </>
                )}
              </dd>
              {isFetchingScheduled ? (
                <>
                  <dt className="font-medium text-muted-foreground">Scheduled</dt>
                  <dd className="m-0 inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin align-text-bottom" aria-hidden />
                    Fetching…
                  </dd>
                </>
              ) : site.scheduledPosts !== undefined ? (
                <>
                  <dt className="font-medium text-muted-foreground">Scheduled</dt>
                  <dd className="m-0 flex min-w-0 items-baseline gap-x-1.5 font-medium text-foreground">
                    <span className="inline-block min-w-[3ch] text-right tabular-nums">{site.scheduledPosts.count}</span>
                    <span>Posts</span>
                  </dd>
                </>
              ) : null}
            </dl>
          )}

          <WordPressCardActions
            site={site}
            isTesting={isTesting}
            isDetecting={isDetecting}
            isExtractingNAPAndGraph={isExtractingNAPAndGraph}
            onTest={onTest}
            onDetect={onDetect}
            onExtractNAPAndGraph={onExtractNAPAndGraph}
            onPatchSite={onPatchSite}
            tone={isModal || isEmbedded ? "propertyBlack" : "card"}
            layout={isModal ? "modalFlat" : "default"}
          />
        </>
      ),
    },
    {
      id: "functions-updater",
      label: "Functions Updater",
      icon: FileCode,
      content: (
        <FunctionsUpdaterPanel site={site} disabled={site.enabled === false} />
      ),
    },
    {
      id: "redirect-matcher",
      label: "Redirect Matcher",
      icon: ArrowRightLeft,
      content: (
        <RedirectMatcherPanel site={site} disabled={site.enabled === false} />
      ),
    },
    {
      id: "master-instructions",
      label: "Master Rules",
      icon: ScrollText,
      content:
        isEmbedded || isModal ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto pt-1">
            <MasterInstructionsSection
              siteId={site.id}
              disabled={site.enabled === false}
            />
          </div>
        ) : (
          <div className={`mt-2 space-y-3 pt-2 text-base ${getCyberpunkTextClasses("muted")}`}>
            <p className="leading-relaxed">
              Master Rules (client instructions) are stored in{" "}
              <span className={getCyberpunkTextClasses("secondary")}>Supabase</span>, not in the browser. Edit them
              under <span className="font-medium text-foreground">Dashboard → Master Rules</span> and select this
              property.
            </p>
            <Button type="button" onClick={() => openDashboardMasterRulesSettings(site.id)}>
              Open Master Rules
            </Button>
          </div>
        ),
    },
    {
      id: "sitemaps",
      label: "Sitemaps",
      icon: Map,
      content: (
        <SitemapSection
          site={site}
          layout={isModal ? "modalFlat" : "default"}
          isScrapingSitemap={isScrapingSitemap}
          isGeneratingEntities={isGeneratingEntities}
          isIndexingSitemap={isIndexingSitemap}
          isLoadingCalendar={isLoadingCalendar}
          getScrapingKey={getScrapingKey}
          onScrapeChildSitemap={onScrapeChildSitemap}
          onEntityGeneration={onEntityGeneration}
          onSetEntitySitemap={onSetEntitySitemap}
          onToggleChildSitemapDisabled={onToggleChildSitemapDisabled}
          onIndexSitemap={onIndexSitemap}
          onLoadCalendarPosts={onLoadCalendarPosts}
          onRefreshSitemaps={onDetect}
          isRefreshingSitemaps={isDetecting}
          onAppendManualChildSitemap={onAppendManualChildSitemap}
        />
      ),
    },
    ...(NEO_PULSE_CA_DEPLOY
      ? []
      : [
          {
            id: "post-bank" as const,
            label: "Bank",
            icon: PiggyBank,
            content: <BankPropertyPanel site={site} />,
          },
        ]),
    ...(siteSettingsPanel
      ? [
          {
            id: "site-settings" as const,
            label: "Settings",
            icon: Settings,
            content: (
              <div className="flex w-full min-w-0 shrink-0 flex-col">{siteSettingsPanel}</div>
            ),
          },
        ]
      : []),
    {
      id: "wp-engine",
      label: "WP Engine",
      icon: Server,
      content: (
        <WpEnginePropertyPanel site={site} onPatchSite={onPatchSite} />
      ),
    },
  ];
}
