import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, FileCode, LayoutDashboard, Loader2, Map, PiggyBank, ScrollText, Settings } from "lucide-react";
import { type WordPressSite } from "../types";
import { WordPressCardHeader } from "./WordPressCardHeader";
import { WordPressCardStatus } from "./WordPressCardStatus";
import { WordPressCardActions } from "./WordPressCardActions";
import { SitemapSection } from "./SitemapSection";
import { getCyberpunkCardClasses, getCyberpunkTextClasses, BREATHE_NEON_ANIMATION } from "./cyberpunk-theme";
import { UNIFIED_TOOLBAR_CLASS } from "@/components/shared/UnifiedWorkspaceChrome";
import {
  WordPressSiteAdminLayout,
  type WordPressSiteAdminSectionId,
} from "./WordPressSiteAdminLayout";
import { WordPressPropertySectionPills } from "./WordPressPropertySectionPills";
import { openDashboardMasterRulesSettings } from "@/lib/open-master-rules-settings";
import { BankPropertyPanel } from "./BankPropertyPanel";
import { FLOWBIE_CA_DEPLOY } from "@/lib/flowbie-ca-deploy";
import { MasterInstructionsSection } from "./MasterInstructionsSection";
import { FunctionsUpdaterPanel } from "./FunctionsUpdaterPanel";
import { RedirectMatcherPanel } from "./RedirectMatcherPanel";
interface WordPressSiteCardProps {
  site: WordPressSite;
  isTesting: boolean;
  isDetecting: boolean;
  isFetchingScheduled: boolean;
  isScrapingSitemap: Record<string, boolean>;
  isGeneratingEntities?: Record<string, boolean>;
  isIndexingSitemap?: Record<string, boolean>;
  onTest: () => void;
  onDetect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onScrapeChildSitemap: (childSitemapUrl: string) => void;
  onEntityGeneration?: (sitemapUrl: string) => void;
  onSetEntitySitemap?: (sitemapUrl: string) => void;
  onToggleChildSitemapDisabled?: (childSitemapUrl: string) => void;
  onAppendManualChildSitemap?: (url: string) => void;
  onIndexSitemap?: (sitemapUrl: string) => void;
  getScrapingKey: (siteId: string, sitemapUrl: string) => string;
  isLoadingCalendar?: Record<string, boolean>;
  onLoadCalendarPosts?: (sitemapUrl: string) => void;
  isExtractingNAPAndGraph?: boolean;
  onExtractNAPAndGraph?: () => void;
  showSiteInfoInHeader?: boolean;
  embedded?: boolean;
  hideHeader?: boolean;
  hideStatus?: boolean;
  /** Main admin panel height (e.g. "80vh") with internal scroll; typical for embedded list expand. */
  displayViewportHeight?: string;
  /** Persist partial site updates (e.g. Semrush project ID from Site Settings). */
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
  /** Expanded panel only: full property form (URLs, credentials, integrations). */
  embeddedSiteEditPanel?: React.ReactNode;
}

export const WordPressSiteCard: React.FC<WordPressSiteCardProps> = ({
  site,
  isTesting,
  isDetecting,
  isFetchingScheduled,
  isScrapingSitemap,
  isGeneratingEntities = {},
  isIndexingSitemap = {},
  onTest,
  onDetect,
  onEdit,
  onDelete,
  onToggle,
  onScrapeChildSitemap,
  onEntityGeneration,
  onSetEntitySitemap,
  onToggleChildSitemapDisabled,
  onAppendManualChildSitemap,
  onIndexSitemap,
  getScrapingKey,
  isLoadingCalendar = {},
  onLoadCalendarPosts,
  isExtractingNAPAndGraph = false,
  onExtractNAPAndGraph,
  showSiteInfoInHeader = true,
  embedded = false,
  hideHeader = false,
  hideStatus = false,
  displayViewportHeight,
  onPatchSite,
  embeddedSiteEditPanel,
}) => {
  const [activeSectionId, setActiveSectionId] =
    React.useState<WordPressSiteAdminSectionId>("overview");

  React.useEffect(() => {
    setActiveSectionId("overview");
  }, [site.id]);

  const Wrapper: React.ElementType = embedded ? "div" : Card;
  const wrapperClassName = embedded
    ? "flex h-full min-h-0 min-w-0 flex-1 flex-col pt-0 px-0 pb-0"
    : `p-3 ${getCyberpunkCardClasses(false, true)} transition-all duration-300`;

  const showSitemapSummary = !!site.sitemaps;

  const sections = [
    {
      id: "overview" as const,
      label: "Overview",
      icon: LayoutDashboard,
      content: (
        <>
          {showSitemapSummary && !embedded && (
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
            tone="card"
          />
        </>
      ),
    },
    {
      id: "functions-updater" as const,
      label: "Functions Updater",
      icon: FileCode,
      content: (
        <FunctionsUpdaterPanel
          site={site}
          disabled={site.enabled === false}
        />
      ),
    },
    {
      id: "redirect-matcher" as const,
      label: "Redirect Matcher",
      icon: ArrowRightLeft,
      content: (
        <RedirectMatcherPanel
          site={site}
          disabled={site.enabled === false}
        />
      ),
    },
    {
      id: "master-instructions" as const,
      label: "Master Rules",
      icon: ScrollText,
      content: embedded ? (
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
      id: "sitemaps" as const,
      label: "Sitemaps",
      icon: Map,
      content: (
        <SitemapSection
          site={site}
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
    ...(FLOWBIE_CA_DEPLOY
      ? []
      : [
          {
            id: "post-bank" as const,
            label: "Bank",
            icon: PiggyBank,
            content: <BankPropertyPanel site={site} />,
          },
        ]),
    ...(embeddedSiteEditPanel
      ? [
          {
            id: "site-settings" as const,
            label: "Site Settings",
            icon: Settings,
            content: (
              <div className="flex w-full min-w-0 shrink-0 flex-col">{embeddedSiteEditPanel}</div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <style>{BREATHE_NEON_ANIMATION}</style>
      <Wrapper className={wrapperClassName}>
        {!hideHeader && (
          <WordPressCardHeader
            site={site}
            onEdit={onEdit}
            onDelete={onDelete}
            showSiteInfo={showSiteInfoInHeader}
          />
        )}

        {!hideStatus && (
          <WordPressCardStatus site={site} isTesting={isTesting} onToggle={onToggle} />
        )}

        {embedded ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <nav className={UNIFIED_TOOLBAR_CLASS} aria-label="Property sections">
              <WordPressPropertySectionPills
                sections={sections.map((s) => ({ id: s.id, label: s.label }))}
                activeSectionId={activeSectionId}
                onSectionChange={(id) => setActiveSectionId(id as WordPressSiteAdminSectionId)}
              />
            </nav>
            <WordPressSiteAdminLayout
              sections={sections}
              defaultSectionId="overview"
              displayViewportHeight={displayViewportHeight}
              hideSectionNav
              activeSectionId={activeSectionId}
              onActiveSectionChange={setActiveSectionId}
              flatContentPanel
              propertyTabContentShell
              fillParent
            />
          </div>
        ) : (
          <WordPressSiteAdminLayout
            sections={sections}
            defaultSectionId="overview"
            displayViewportHeight={displayViewportHeight}
            flatContentPanel={embedded}
            collapsibleSideNav={embedded}
          />
        )}
      </Wrapper>
    </>
  );
};
