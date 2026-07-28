import type { MouseEvent } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { WordPressSite } from "@/components/integrations/types";
import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import {
  GbpPostPublishPreview,
  type GbpPublishPreview,
} from "@/components/gbp-post/GbpPostPublishPreview";
import {
  contentOptimizerRowStripeClass,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  GBP_ROSTER_ROW_GRID_CLASS,
  GBP_ROSTER_SITE_NAME_FIELD,
  GBP_ROSTER_SITE_NAME_TEXT,
  GBP_ROSTER_TOPIC_CELL,
} from "@/components/gbp-post/gbp-post-roster-layout";
import { gbpRosterSiteDisplayName } from "@/lib/gbp-post/gbp-roster-site-display-name";
import { cn } from "@/lib/utils";

const GBP_ROW_EXPANDED_ACTIONS_CLASS =
  "flex w-full min-w-0 min-h-9 items-center justify-between gap-2 sm:min-h-10";

type Props = {
  sites: WordPressSite[];
  selectedSiteIds: Set<string>;
  topicBySiteId: Record<string, string>;
  expandedSiteId: string | null;
  previewBySiteId: Record<string, GbpPublishPreview | null>;
  postingSiteIds: ReadonlySet<string>;
  isPosting?: boolean;
  disabled?: boolean;
  onTopicChange: (siteId: string, topic: string) => void;
  onToggleSite: (siteId: string, checked: boolean) => void;
  onToggleExpandedSiteId: (siteId: string) => void;
  className?: string;
};

export function GbpPostClientRoster({
  sites,
  selectedSiteIds,
  topicBySiteId,
  expandedSiteId,
  previewBySiteId,
  postingSiteIds,
  isPosting = false,
  disabled = false,
  onTopicChange,
  onToggleSite,
  onToggleExpandedSiteId,
  className,
}: Props) {
  const placeholderCount = Math.max(0, BULK_GENERATOR_EMPTY_ROW_COUNT - sites.length);
  const placeholderOnlyBody = sites.length < BULK_GENERATOR_EMPTY_ROW_COUNT;

  const renderRowHeader = (
    site: WordPressSite,
    stripeIndex: number,
    isExpanded: boolean,
    panelId: string,
    rowBusy: boolean,
  ) => {
    const displayName = gbpRosterSiteDisplayName(site);

    const handleRowClick = (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button, a, [role='combobox'], input, textarea, label")) return;
      onToggleExpandedSiteId(site.id);
    };

    return (
      <div
        className={cn(
          !isExpanded && contentOptimizerRowStripeClass(stripeIndex),
          !isExpanded && "hover:bg-zinc-900",
          isExpanded ? GBP_ROW_EXPANDED_ACTIONS_CLASS : GBP_ROSTER_ROW_GRID_CLASS,
          "cursor-pointer",
        )}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpandedSiteId(site.id);
          }
        }}
      >
        {!isExpanded ? (
          <>
            <div className="flex items-center justify-center self-start pt-0.5">
              <Checkbox
                checked={selectedSiteIds.has(site.id)}
                onCheckedChange={(v) => onToggleSite(site.id, v === true)}
                aria-label={`Select ${site.name}`}
                disabled={disabled}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className={GBP_ROSTER_SITE_NAME_FIELD}>
              <span className={GBP_ROSTER_SITE_NAME_TEXT}>{displayName}</span>
            </div>

            <div className={GBP_ROSTER_TOPIC_CELL}>
              <Input
                variant="flowbieBlack"
                aria-label={`Topic for ${site.name}`}
                value={topicBySiteId[site.id] ?? ""}
                onChange={(e) => onTopicChange(site.id, e.target.value)}
                disabled={disabled}
                onClick={(e) => e.stopPropagation()}
                className="h-8 w-full rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
              />
            </div>
          </>
        ) : (
          <div className={cn(GBP_ROSTER_SITE_NAME_FIELD, "flex-1")}>
            <span className={GBP_ROSTER_SITE_NAME_TEXT}>{displayName}</span>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-end gap-1 self-start pt-0.5 sm:gap-2">
          {rowBusy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-label="Posting" />
          ) : null}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center sm:h-8 sm:w-8" aria-hidden>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-zinc-300" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-300" />
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flowbie-manager-tab-scroll min-h-0 w-full flex-1 overflow-x-hidden overscroll-y-contain",
        placeholderOnlyBody ? "flex flex-col overflow-y-hidden" : "overflow-y-auto",
        className,
      )}
    >
      <div
        className={cn(
          CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
          placeholderOnlyBody && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        {sites.map((site, stripeIndex) => {
          const isExpanded = expandedSiteId === site.id;
          const panelId = `gbp-post-row-panel-${site.id}`;
          const preview = previewBySiteId[site.id] ?? null;
          const rowBusy = isPosting && postingSiteIds.has(site.id);
          const previewLoading = rowBusy && !preview;

          if (!isExpanded) {
            return (
              <div key={site.id} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
                {renderRowHeader(site, stripeIndex, false, panelId, rowBusy)}
              </div>
            );
          }

          return (
            <div key={site.id} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
              <div className={contentOptimizerRowStripeClass(stripeIndex)}>
                {renderRowHeader(site, stripeIndex, true, panelId, rowBusy)}
                <div id={panelId} className="px-2.5 py-2 sm:px-3">
                  <GbpPostPublishPreview
                    preview={preview}
                    loading={previewLoading}
                    embedded
                    className="px-0 py-0"
                  />
                </div>
              </div>
            </div>
          );
        })}
        {Array.from({ length: placeholderCount }, (_, offset) => {
          const stripeIndex = sites.length + offset;
          return (
            <div key={`gbp-roster-placeholder-${stripeIndex}`} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
              <div
                className={cn(contentOptimizerRowStripeClass(stripeIndex), GBP_ROSTER_ROW_GRID_CLASS)}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
