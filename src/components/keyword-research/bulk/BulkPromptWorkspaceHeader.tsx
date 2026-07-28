import React, { type ReactNode } from "react";
import { CheckCircle2, Loader2, TrendingUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import {
  GENERATOR_WORKSPACE_TITLE,
  type BlogGeneratorSectionId,
} from "@/components/blog-generator/blog-generator-sections";
import { BulkGeneratorRunActions } from "@/components/keyword-research/bulk/BulkGeneratorRunActions";
import {
  BulkGeneratorDetailsPanel,
  type BulkGeneratorDetailsPanelProps,
} from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_SELECT_TRIGGER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";
import { cn } from "@/lib/utils";

const POST_DESTINATION_SHORT: Record<WordPressPostDestination, string> = {
  wordpress: "WordPress",
  bank: "Bank",
  hybrid: "Hybrid",
  local: "Local files",
};

type FeaturedImageMode = "off" | "ai-generated" | "google-maps";

export type BulkPromptWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  canOpenDetails: boolean;
  isProcessing: boolean;
  generalIntent: string;
  onGeneralIntentChange: (v: string) => void;
  numberOfBlogs: number;
  onNumberOfBlogsChange: (v: number) => void;
  optionalPrompt: string;
  onOptionalPromptChange: (v: string) => void;
  featuredImagePerBlog: boolean;
  onFeaturedImagePerBlogChange: (v: boolean) => void;
  featuredImageType: "ai-generated" | "google-maps";
  onFeaturedImageTypeChange: (v: "ai-generated" | "google-maps") => void;
  isGeneratingChecklist: boolean;
  hasGeneratedChecklist: boolean;
  onGenerateChecklist: () => void;
  onApprove: () => void;
  postDestination: WordPressPostDestination;
  onPostDestinationChange: (v: WordPressPostDestination) => void;
  postDestinationChoices: WordPressPostDestination[];
  onCancel: () => void;
  onClear: () => void;
  scheduleMenu?: ReactNode;
  sitemapMenu?: ReactNode;
  detailsProps: BulkGeneratorDetailsPanelProps;
};

export function BulkPromptWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspaceBusy,
  progressSnapshot,
  canOpenDetails,
  isProcessing,
  generalIntent,
  onGeneralIntentChange,
  numberOfBlogs,
  onNumberOfBlogsChange,
  optionalPrompt,
  onOptionalPromptChange,
  featuredImagePerBlog,
  onFeaturedImagePerBlogChange,
  featuredImageType,
  onFeaturedImageTypeChange,
  isGeneratingChecklist,
  hasGeneratedChecklist,
  onGenerateChecklist,
  onApprove,
  postDestination,
  onPostDestinationChange,
  postDestinationChoices,
  onCancel,
  onClear,
  scheduleMenu,
  sitemapMenu,
  detailsProps,
}: BulkPromptWorkspaceHeaderProps) {
  const featuredImageMode: FeaturedImageMode = featuredImagePerBlog ? featuredImageType : "off";

  const handleFeaturedImageMode = (value: FeaturedImageMode) => {
    if (value === "off") {
      onFeaturedImagePerBlogChange(false);
      return;
    }
    onFeaturedImagePerBlogChange(true);
    onFeaturedImageTypeChange(value);
  };

  return (
    <BlogGeneratorWorkspaceChrome
      icon={TrendingUp}
      title={GENERATOR_WORKSPACE_TITLE}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={isProcessing}
      titleRowMenu={
        sitemapMenu || scheduleMenu ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {sitemapMenu}
            {scheduleMenu}
          </div>
        ) : null
      }
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId="bulk-prompt-details-panel"
      toolbar={
        <div className="flex w-full min-w-0 items-center gap-2">
          <Input
            type="text"
            placeholder="General intent / topic"
            value={generalIntent}
            onChange={(e) => onGeneralIntentChange(e.target.value)}
            className={cn(BULK_HEADER_FIELD, "min-w-[12rem] flex-1 text-base")}
            disabled={workspaceBusy}
            autoComplete="off"
            aria-label="General intent or content topic"
          />
          <div className="flex shrink-0 flex-nowrap items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              value={numberOfBlogs}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n) && n >= 1) onNumberOfBlogsChange(n);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  onNumberOfBlogsChange(numberOfBlogs + 1);
                } else if (e.key === "ArrowDown" && numberOfBlogs > 1) {
                  e.preventDefault();
                  onNumberOfBlogsChange(numberOfBlogs - 1);
                }
              }}
              className={cn(BULK_HEADER_FIELD, "w-[3.25rem] shrink-0 text-center font-mono text-base [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto")}
              disabled={workspaceBusy}
              aria-label="Number of blogs"
              title="Number of blogs to generate"
            />
            <Input
              type="text"
              placeholder="Prompt modifier"
              value={optionalPrompt}
              onChange={(e) => onOptionalPromptChange(e.target.value)}
              className={cn(BULK_HEADER_FIELD, "w-[9rem] shrink-0 text-base")}
              disabled={workspaceBusy}
              autoComplete="off"
              aria-label="Optional prompt modifier"
              title="Optional prompt modifier - tone, audience, style"
            />
            <Select
              value={featuredImageMode}
              onValueChange={(v) => handleFeaturedImageMode(v as FeaturedImageMode)}
              disabled={workspaceBusy}
            >
              <SelectTrigger
                className={cn(BULK_HEADER_SELECT_TRIGGER, "min-w-[9rem]")}
                aria-label="Featured image"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem className="text-base" value="off">
                  Image off
                </SelectItem>
                <SelectItem className="text-base" value="ai-generated">
                  AI image
                </SelectItem>
                <SelectItem className="text-base" value="google-maps">
                  Google Maps
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={postDestination}
              onValueChange={(v) => onPostDestinationChange(v as WordPressPostDestination)}
              disabled={workspaceBusy}
            >
              <SelectTrigger
                className={cn(BULK_HEADER_SELECT_TRIGGER, "min-w-[8.5rem]")}
                aria-label="Export destination"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {postDestinationChoices.map((choice) => (
                  <SelectItem key={choice} className="text-base" value={choice}>
                    {POST_DESTINATION_SHORT[choice]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <BulkGeneratorRunActions
              isProcessing={isProcessing}
              canRun={false}
              workspaceBusy={workspaceBusy}
              onRun={() => {}}
              onCancel={onCancel}
              onClear={onClear}
              hideRunButton
              groupClassName="contents"
              trailing={
                <Button
                  type="button"
                  size="sm"
                  className={BULK_HEADER_RUN_BTN}
                  disabled={
                    workspaceBusy || isGeneratingChecklist || (hasGeneratedChecklist && isProcessing)
                  }
                  aria-label={hasGeneratedChecklist ? "Approve" : "Ideas"}
                  title={hasGeneratedChecklist ? "Approve" : "Ideas"}
                  onClick={hasGeneratedChecklist ? onApprove : onGenerateChecklist}
                >
                  {isGeneratingChecklist ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : hasGeneratedChecklist ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {hasGeneratedChecklist ? "Approve" : "Ideas"}
                </Button>
              }
            />
          </div>
        </div>
      }
      detailsPanel={<BulkGeneratorDetailsPanel {...detailsProps} />}
    />
  );
}
