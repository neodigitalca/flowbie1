import { useRef, type ReactNode } from "react";
import { Download, Loader2, TrendingUp, Upload } from "lucide-react";
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
import {
  BulkGeneratorDetailsPanel,
  type BulkGeneratorDetailsPanelProps,
} from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import { BulkGeneratorRunActions } from "@/components/keyword-research/bulk/BulkGeneratorRunActions";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_ICON_RUN_BTN,
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_SELECT_TRIGGER,
  BULK_HEADER_UPLOAD_READY_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { BlogImportFeaturedImage } from "@/lib/bulk/blog-import-parser";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";
import { cn } from "@/lib/utils";

const POST_DESTINATION_SHORT: Record<WordPressPostDestination, string> = {
  wordpress: "WordPress",
  bank: "Bank",
  hybrid: "Hybrid",
  local: "Local files",
};

export type BlogImportWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  canOpenDetails: boolean;
  focusKeyword: string;
  onFocusKeywordChange: (v: string) => void;
  titleOverride: string;
  onTitleOverrideChange: (v: string) => void;
  featuredImageMode: BlogImportFeaturedImage;
  onFeaturedImageModeChange: (v: BlogImportFeaturedImage) => void;
  entity: string;
  onEntityChange: (v: string) => void;
  isParsing: boolean;
  importedFileName: string | null;
  onPickFile: (file: File | null) => void;
  postDestination: WordPressPostDestination;
  onPostDestinationChange: (v: WordPressPostDestination) => void;
  postDestinationChoices: WordPressPostDestination[];
  canRun: boolean;
  isProcessing: boolean;
  onRun: () => void;
  onCancel: () => void;
  onClear: () => void;
  canDownloadBlog?: boolean;
  onDownloadBlog?: () => void;
  scheduleMenu?: ReactNode;
  detailsProps: BulkGeneratorDetailsPanelProps;
};

export function BlogImportWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspaceBusy,
  progressSnapshot,
  canOpenDetails,
  focusKeyword,
  onFocusKeywordChange,
  titleOverride,
  onTitleOverrideChange,
  featuredImageMode,
  onFeaturedImageModeChange,
  entity,
  onEntityChange,
  isParsing,
  importedFileName,
  onPickFile,
  postDestination,
  onPostDestinationChange,
  postDestinationChoices,
  canRun,
  isProcessing,
  onRun,
  onCancel,
  onClear,
  canDownloadBlog = false,
  onDownloadBlog,
  scheduleMenu,
  detailsProps,
}: BlogImportWorkspaceHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <BlogGeneratorWorkspaceChrome
      icon={TrendingUp}
      title={GENERATOR_WORKSPACE_TITLE}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sectionSwitchDisabled={isProcessing}
      titleRowMenu={scheduleMenu}
      workspaceBusy={workspaceBusy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={isProcessing}
      detailsPanelId="blog-import-details-panel"
      toolbar={
        <div className="flex w-full min-w-0 flex-nowrap items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onPickFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant={importedFileName ? "default" : "ghost"}
            size="sm"
            className={
              importedFileName ? BULK_HEADER_ICON_RUN_BTN : BULK_HEADER_ICON_TOOL_BTN
            }
            disabled={isParsing || isProcessing}
            onClick={() => fileRef.current?.click()}
            aria-label={importedFileName ? `Uploaded: ${importedFileName}` : "Upload blog file"}
            title={importedFileName ?? "Choose blog file"}
          >
            {isParsing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </Button>
          <Input
            type="text"
            placeholder="Keyword"
            value={focusKeyword}
            onChange={(e) => onFocusKeywordChange(e.target.value)}
            className={cn(BULK_HEADER_FIELD, "min-w-0 flex-1 text-base")}
            disabled={workspaceBusy}
            autoComplete="off"
            aria-label="Focus keyword"
          />
          <Input
            type="text"
            placeholder="Title override"
            value={titleOverride}
            onChange={(e) => onTitleOverrideChange(e.target.value)}
            className={cn(BULK_HEADER_FIELD, "min-w-0 flex-1 text-base")}
            disabled={workspaceBusy}
            autoComplete="off"
            aria-label="Title override"
          />
          <Select
            value={featuredImageMode}
            onValueChange={(v) => onFeaturedImageModeChange(v as BlogImportFeaturedImage)}
            disabled={workspaceBusy}
          >
            <SelectTrigger
              className={cn(BULK_HEADER_SELECT_TRIGGER, "w-[9rem] shrink-0")}
              aria-label="Featured image"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem className="text-base" value="y">
                AI image
              </SelectItem>
              <SelectItem className="text-base" value="google-maps">
                Google Maps
              </SelectItem>
              <SelectItem className="text-base" value="n">
                None
              </SelectItem>
            </SelectContent>
          </Select>
          {featuredImageMode === "google-maps" ? (
            <Input
              type="text"
              placeholder="Entity"
              value={entity}
              onChange={(e) => onEntityChange(e.target.value)}
              className={cn(BULK_HEADER_FIELD, "w-[9rem] shrink-0 text-base")}
              disabled={workspaceBusy}
              autoComplete="off"
              aria-label="Entity for Google Maps"
            />
          ) : null}
          <Select
            value={postDestination}
            onValueChange={(v) => onPostDestinationChange(v as WordPressPostDestination)}
            disabled={workspaceBusy}
          >
            <SelectTrigger
              className={cn(BULK_HEADER_SELECT_TRIGGER, "w-[9.5rem] shrink-0")}
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
            canRun={canRun}
            workspaceBusy={workspaceBusy}
            onRun={onRun}
            onCancel={onCancel}
            onClear={onClear}
            groupClassName="contents"
            trailing={
              canDownloadBlog && onDownloadBlog ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className={cn(BULK_HEADER_UPLOAD_READY_BTN, "h-8 shrink-0 gap-1.5")}
                  onClick={onDownloadBlog}
                  aria-label="Download blog"
                  title="Download blog"
                >
                  <Download className="h-4 w-4 shrink-0" aria-hidden />
                  Download blog
                </Button>
              ) : null
            }
          />
        </div>
      }
      detailsPanel={<BulkGeneratorDetailsPanel {...detailsProps} />}
    />
  );
}
