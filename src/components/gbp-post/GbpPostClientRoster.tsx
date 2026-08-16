import type { WordPressSite } from "@/components/integrations/types";
import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import { GbpPostRowCompact } from "@/components/gbp-post/GbpPostRowCompact";
import { GbpPostRowDetails } from "@/components/gbp-post/GbpPostRowDetails";
import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";
import { GBP_POST_ROW_GRID_CLASS } from "@/components/gbp-post/gbp-post-row-constants";
import {
  contentOptimizerRowStripeClass,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";

type Props = {
  sites: WordPressSite[];
  selectedSiteIds: Set<string>;
  topicBySiteId: Record<string, string>;
  landingPageUrlBySiteId: Record<string, string>;
  expandedSiteId: string | null;
  previewBySiteId: Record<string, GbpPublishPreview | null>;
  postingSiteIds: ReadonlySet<string>;
  isPosting?: boolean;
  disabled?: boolean;
  gmbConnected?: boolean;
  onTopicChange: (siteId: string, topic: string) => void;
  onLandingPageChange: (siteId: string, url: string) => void;
  onToggleSite: (siteId: string, checked: boolean) => void;
  onToggleExpandedSiteId: (siteId: string) => void;
  className?: string;
};

export function GbpPostClientRoster({
  sites,
  selectedSiteIds,
  topicBySiteId,
  landingPageUrlBySiteId,
  expandedSiteId,
  previewBySiteId,
  postingSiteIds,
  isPosting = false,
  disabled = false,
  gmbConnected = false,
  onTopicChange,
  onLandingPageChange,
  onToggleSite,
  onToggleExpandedSiteId,
  className,
}: Props) {
  const placeholderCount = Math.max(0, BULK_GENERATOR_EMPTY_ROW_COUNT - sites.length);
  const placeholderOnlyBody = sites.length < BULK_GENERATOR_EMPTY_ROW_COUNT;

  const renderRow = (site: WordPressSite, stripeIndex: number) => {
    const panelId = `gbp-post-row-panel-${site.id}`;
    const isExpanded = expandedSiteId === site.id;
    const preview = previewBySiteId[site.id] ?? null;
    const rowBusy = isPosting && postingSiteIds.has(site.id);
    const previewLoading = rowBusy && !preview;

    const sharedProps = {
      site,
      keyword: topicBySiteId[site.id] ?? "",
      landingPageUrl: landingPageUrlBySiteId[site.id] ?? "",
      isSelected: selectedSiteIds.has(site.id),
      stripeIndex,
      panelId,
      rowBusy,
      disabled,
      onToggle: () => onToggleExpandedSiteId(site.id),
      onToggleSelected: (checked: boolean) => onToggleSite(site.id, checked),
      onKeywordChange: (keyword: string) => onTopicChange(site.id, keyword),
      onLandingPageChange: (url: string) => onLandingPageChange(site.id, url),
    };

    if (!isExpanded) {
      return <GbpPostRowCompact {...sharedProps} isExpanded={false} />;
    }

    return (
      <div className={cn(contentOptimizerRowStripeClass(stripeIndex), "w-full min-w-0")}>
        <GbpPostRowCompact {...sharedProps} isExpanded embedded />
        <GbpPostRowDetails preview={preview} loading={previewLoading} panelId={panelId} />
      </div>
    );
  };

  return (
    <div
      className={cn(
        "neo-pulse-manager-tab-scroll min-h-0 w-full flex-1 overflow-x-hidden overscroll-y-contain",
        placeholderOnlyBody ? "flex flex-col overflow-y-hidden" : "overflow-y-auto",
        className,
      )}
    >
      {sites.length === 0 ? (
        <div className="px-4 py-6 text-base text-muted-foreground">
          {gmbConnected ? (
            <p>
              Google is connected. Add a{" "}
              <strong className="text-foreground">Google Business Profile Location ID</strong> on each
              property under Dashboard → Properties → Edit site, then return here to post.
            </p>
          ) : (
            <p>
              Connect Google Business using the button above, then add a{" "}
              <strong className="text-foreground">GBP Location ID</strong> on each property under
              Dashboard → Properties.
            </p>
          )}
        </div>
      ) : null}
      <div
        className={cn(
          CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
          placeholderOnlyBody && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        {sites.map((site, stripeIndex) => (
          <div key={site.id} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
            {renderRow(site, stripeIndex)}
          </div>
        ))}
        {Array.from({ length: placeholderCount }, (_, offset) => {
          const stripeIndex = sites.length + offset;
          return (
            <div key={`gbp-roster-placeholder-${stripeIndex}`} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
              <div
                className={cn(contentOptimizerRowStripeClass(stripeIndex), GBP_POST_ROW_GRID_CLASS)}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
