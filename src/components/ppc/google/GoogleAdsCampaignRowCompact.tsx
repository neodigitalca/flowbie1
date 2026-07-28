import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  contentOptimizerRowStripeClass,
  contentOptimizerRowStripeHoverClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { GoogleAdsCampaignRowGenerateButton } from "@/components/ppc/google/GoogleAdsCampaignRowGenerateButton";
import { GoogleAdsLandingPageField } from "@/components/ppc/google/GoogleAdsLandingPageField";
import { GoogleAdsRowEndRail } from "@/components/ppc/google/GoogleAdsRowEndRail";
import {
  PPC_CAMPAIGN_ROW_FIELD_CELL,
  PPC_CAMPAIGN_ROW_GRID_CLASS,
  PPC_ROW_CONTENT_SPAN_CLASS,
} from "@/components/ppc/google/google-ads-row-constants";
import { PPC_DETAIL_INPUT_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import {
  resolvePpcRowCampaignName,
  resolvePpcRowFocusKeyword,
  resolvePpcRowLandingPageUrl,
  type PpcCampaignRow,
  type PpcWpPageContext,
} from "@/lib/ppc/google-ads-types";
import { cn } from "@/lib/utils";

export type GoogleAdsCampaignRowCompactProps = {
  row: PpcCampaignRow;
  isExpanded: boolean;
  panelId?: string;
  embedded?: boolean;
  stripeIndex?: number;
  deleteDisabled?: boolean;
  nameReadOnly?: boolean;
  keywordReadOnly?: boolean;
  landingPageReadOnly?: boolean;
  wpPages?: PpcWpPageContext[];
  wpPagesLoading?: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onNameChange?: (name: string) => void;
  onKeywordChange?: (keyword: string) => void;
  onLandingPageChange?: (url: string) => void;
  onLoadWpPages?: () => void;
  generateDisabled?: boolean;
  isRowGenerating?: boolean;
  onGenerate?: () => void;
};

function GoogleAdsCampaignRowActions({
  isExpanded,
  deleteDisabled,
  generateDisabled,
  isRowGenerating,
  onDelete,
  onGenerate,
  onToggle,
}: {
  isExpanded: boolean;
  deleteDisabled?: boolean;
  generateDisabled?: boolean;
  isRowGenerating?: boolean;
  onDelete?: () => void;
  onGenerate?: () => void;
  onToggle: () => void;
}) {
  return (
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
      deleteLabel="Delete campaign"
      chevron={
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-foreground"
          aria-label={isExpanded ? "Collapse campaign" : "Expand campaign"}
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
  );
}

export function GoogleAdsCampaignRowCompact({
  row,
  isExpanded,
  panelId,
  embedded = false,
  stripeIndex = 0,
  deleteDisabled = false,
  nameReadOnly = false,
  keywordReadOnly = false,
  landingPageReadOnly = false,
  wpPages = [],
  wpPagesLoading = false,
  onToggle,
  onDelete,
  onNameChange,
  onKeywordChange,
  onLandingPageChange,
  onLoadWpPages,
  generateDisabled = false,
  isRowGenerating = false,
  onGenerate,
}: GoogleAdsCampaignRowCompactProps) {
  const nameValue = resolvePpcRowCampaignName(row);
  const keywordValue = resolvePpcRowFocusKeyword(row);
  const landingPageValue = resolvePpcRowLandingPageUrl(row);
  const displayName = nameValue.trim() || (row.status === "generating" ? "Generating…" : "");
  const canEditName = !nameReadOnly && Boolean(onNameChange);
  const canEditKeyword = !keywordReadOnly && Boolean(onKeywordChange);
  const canEditLandingPage = !landingPageReadOnly && Boolean(onLandingPageChange);

  const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a, [role='combobox'], input, textarea, [data-landing-page-picker]")) return;
    onToggle();
  };

  const landingPageField = canEditLandingPage ? (
    <GoogleAdsLandingPageField
      value={landingPageValue}
      wpPages={wpPages}
      wpPagesLoading={wpPagesLoading}
      disabled={landingPageReadOnly}
      onOpen={onLoadWpPages}
      onChange={(url) => onLandingPageChange?.(url)}
    />
  ) : (
    <span className="block min-w-0 truncate text-base text-zinc-100">
      {landingPageValue || "Landing page"}
    </span>
  );

  return (
    <div
      className={cn(
        !embedded && contentOptimizerRowStripeClass(stripeIndex),
        !embedded && contentOptimizerRowStripeHoverClass(stripeIndex),
        PPC_CAMPAIGN_ROW_GRID_CLASS,
        "cursor-pointer",
      )}
      aria-controls={panelId}
      onClick={handleRowClick}
    >
      {!isExpanded ? (
        <>
          <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>
            {canEditName ? (
              <Input
                value={nameValue}
                placeholder="Campaign name"
                className={cn(PPC_DETAIL_INPUT_CLASS, "h-9 w-full min-w-0 font-bold text-zinc-100")}
                aria-label="Campaign name"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => onNameChange?.(e.target.value)}
              />
            ) : (
              <span className="whitespace-normal break-words text-base font-bold leading-snug text-zinc-100">
                {displayName}
              </span>
            )}
          </div>

          <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>{landingPageField}</div>

          <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>
            {canEditKeyword ? (
              <Input
                value={keywordValue}
                placeholder="Keyword"
                className={cn(PPC_DETAIL_INPUT_CLASS, "h-9 w-full min-w-0 text-zinc-100")}
                aria-label="Keyword"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => onKeywordChange?.(e.target.value)}
              />
            ) : (
              <span className="whitespace-normal break-words text-base leading-snug text-zinc-100">
                {keywordValue}
              </span>
            )}
          </div>

          <GoogleAdsCampaignRowActions
            isExpanded={false}
            deleteDisabled={deleteDisabled}
            generateDisabled={generateDisabled}
            isRowGenerating={isRowGenerating}
            onDelete={onDelete}
            onGenerate={onGenerate}
            onToggle={onToggle}
          />
        </>
      ) : embedded ? (
        <>
          <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>
            {canEditName ? (
              <Input
                value={nameValue}
                placeholder="Campaign name"
                className={cn(PPC_DETAIL_INPUT_CLASS, "h-9 w-full min-w-0 font-bold text-zinc-100")}
                aria-label="Campaign name"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => onNameChange?.(e.target.value)}
              />
            ) : (
              <span className="block min-w-0 truncate text-base font-bold text-zinc-100">
                {displayName}
              </span>
            )}
          </div>
          <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>{landingPageField}</div>
          <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>
            {canEditKeyword ? (
              <Input
                value={keywordValue}
                placeholder="Keyword"
                className={cn(PPC_DETAIL_INPUT_CLASS, "h-9 min-w-0 w-full text-zinc-100")}
                aria-label="Keyword"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => onKeywordChange?.(e.target.value)}
              />
            ) : (
              <span className="block min-w-0 truncate text-base text-zinc-100">{keywordValue}</span>
            )}
          </div>
          <GoogleAdsCampaignRowActions
            isExpanded
            deleteDisabled={deleteDisabled}
            generateDisabled={generateDisabled}
            isRowGenerating={isRowGenerating}
            onDelete={onDelete}
            onGenerate={onGenerate}
            onToggle={onToggle}
          />
        </>
      ) : (
        <>
          <div className={PPC_ROW_CONTENT_SPAN_CLASS} aria-hidden />
          <GoogleAdsCampaignRowActions
            isExpanded
            deleteDisabled={deleteDisabled}
            generateDisabled={generateDisabled}
            isRowGenerating={isRowGenerating}
            onDelete={onDelete}
            onGenerate={onGenerate}
            onToggle={onToggle}
          />
        </>
      )}
    </div>
  );
}
