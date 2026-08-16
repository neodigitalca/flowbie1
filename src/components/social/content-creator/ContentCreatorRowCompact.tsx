import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  contentOptimizerRowStripeClass,
  contentOptimizerRowStripeHoverClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { GoogleAdsCampaignRowGenerateButton } from "@/components/ppc/google/GoogleAdsCampaignRowGenerateButton";
import { GoogleAdsRowEndRail } from "@/components/ppc/google/GoogleAdsRowEndRail";
import {
  CONTENT_CREATOR_ROW_FIELD_CELL,
  CONTENT_CREATOR_ROW_GRID_CLASS,
} from "@/components/social/content-creator/content-creator-row-constants";
import { PPC_DETAIL_INPUT_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import type { ContentCalendarRow } from "@/lib/social/content-creator-types";
import { cn } from "@/lib/utils";

export type ContentCreatorRowCompactProps = {
  row: ContentCalendarRow;
  isExpanded: boolean;
  embedded?: boolean;
  panelId?: string;
  stripeIndex?: number;
  deleteDisabled?: boolean;
  fieldsReadOnly?: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onKeywordChange?: (keyword: string) => void;
  onLandingPageChange?: (url: string) => void;
  generateDisabled?: boolean;
  isRowGenerating?: boolean;
  onGenerate?: () => void;
};

export function ContentCreatorRowCompact({
  row,
  isExpanded,
  embedded = false,
  panelId,
  stripeIndex = 0,
  deleteDisabled,
  fieldsReadOnly,
  onToggle,
  onDelete,
  onKeywordChange,
  onLandingPageChange,
  generateDisabled,
  isRowGenerating,
  onGenerate,
}: ContentCreatorRowCompactProps) {
  return (
    <div
      className={cn(
        !embedded && contentOptimizerRowStripeClass(stripeIndex),
        !embedded && contentOptimizerRowStripeHoverClass,
        CONTENT_CREATOR_ROW_GRID_CLASS,
      )}
    >
      <div className={CONTENT_CREATOR_ROW_FIELD_CELL}>
        <Input
          value={row.keyword ?? ""}
          readOnly={fieldsReadOnly}
          disabled={fieldsReadOnly}
          placeholder="Keyword"
          className={PPC_DETAIL_INPUT_CLASS}
          aria-label="Keyword"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onKeywordChange?.(e.target.value)}
        />
      </div>

      <div className={CONTENT_CREATOR_ROW_FIELD_CELL}>
        <Input
          value={row.landingPageUrl ?? ""}
          readOnly={fieldsReadOnly}
          disabled={fieldsReadOnly}
          placeholder="Landing page URL"
          className={PPC_DETAIL_INPUT_CLASS}
          aria-label="Landing page URL"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onLandingPageChange?.(e.target.value)}
        />
      </div>

      <div className="flex min-w-0 items-center justify-end">
        <GoogleAdsRowEndRail
          generate={
            onGenerate ? (
              <GoogleAdsCampaignRowGenerateButton
                busy={isRowGenerating}
                disabled={generateDisabled}
                onClick={onGenerate}
              />
            ) : undefined
          }
          onDelete={onDelete}
          deleteDisabled={deleteDisabled}
          deleteLabel="Delete post"
          chevron={
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center text-foreground hover:text-primary"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              aria-label={isExpanded ? "Collapse post details" : "Expand post details"}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden />
              )}
            </button>
          }
        />
      </div>

      {row.errorMessage ? (
        <p className="col-span-full px-2 pb-1 text-base text-destructive">{row.errorMessage}</p>
      ) : null}
    </div>
  );
}
