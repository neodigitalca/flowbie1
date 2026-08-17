import { useRef, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import { GENERATOR_SELECT } from "@/components/blog-generator/generator-toolbar-theme";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { BulkGeneratorRunActions } from "@/components/keyword-research/bulk/BulkGeneratorRunActions";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";
import {
  BULK_HEADER_ICON_RUN_BTN,
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";
import {
  BULK_AUTO_GENERATE_TEMPLATE_FILENAME,
  BULK_AUTO_GENERATE_TEMPLATE_HREF,
} from "@/lib/bulk/bulk-auto-generate-template-columns";

const POST_DESTINATION_SHORT: Record<WordPressPostDestination, string> = {
  wordpress: "WordPress",
  local: "Local files",
};

export type BulkCsvWorkspaceHeaderProps = {
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
  workspaceBusy: boolean;
  progressSnapshot: MetaBulkMicroSnapshot | null;
  canOpenDetails: boolean;
  isProcessing: boolean;
  csvFileName: string | null;
  rowCount: number;
  onPickCsvFile: (file: File | null) => void;
  csvLoading?: boolean;
  postDestination: WordPressPostDestination;
  onPostDestinationChange: (v: WordPressPostDestination) => void;
  postDestinationChoices: WordPressPostDestination[];
  canRun: boolean;
  onRun: () => void;
  onCancel: () => void;
  onClear: () => void;
  scheduleMenu?: ReactNode;
  sitemapMenu?: ReactNode;
  detailsProps: BulkGeneratorDetailsPanelProps;
  onDetailsOpenChange?: (open: boolean) => void;
};

export function BulkCsvWorkspaceHeader({
  activeSection,
  onSectionChange,
  workspaceBusy,
  progressSnapshot,
  canOpenDetails,
  isProcessing,
  csvFileName,
  rowCount,
  onPickCsvFile,
  csvLoading = false,
  postDestination,
  onPostDestinationChange,
  postDestinationChoices,
  canRun,
  onRun,
  onCancel,
  onClear,
  scheduleMenu,
  sitemapMenu,
  detailsProps,
  onDetailsOpenChange,
}: BulkCsvWorkspaceHeaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <BlogGeneratorWorkspaceChrome
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
      detailsPanelId="bulk-csv-details-panel"
      onDetailsOpenChange={onDetailsOpenChange}
      toolbar={
        <GeneratorToolbarFrame
          primary={
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  onPickCsvFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant={csvFileName ? "default" : "ghost"}
                size="sm"
                className={csvFileName ? BULK_HEADER_ICON_RUN_BTN : BULK_HEADER_ICON_TOOL_BTN}
                disabled={workspaceBusy || csvLoading}
                onClick={() => fileRef.current?.click()}
                aria-label={csvFileName ? `Select CSV: ${csvFileName}` : "Select CSV"}
                title={csvFileName ?? "Select CSV"}
              >
                {csvLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={BULK_HEADER_TOOL_BTN}
                disabled={workspaceBusy}
                asChild
              >
                <a
                  href={BULK_AUTO_GENERATE_TEMPLATE_HREF}
                  download={BULK_AUTO_GENERATE_TEMPLATE_FILENAME}
                  aria-label="Download template CSV"
                  title="Download template CSV"
                >
                  Template
                </a>
              </Button>
              {rowCount > 0 ? (
                <span className="shrink-0 text-base text-muted-foreground tabular-nums">
                  {rowCount} row{rowCount !== 1 ? "s" : ""}
                </span>
              ) : null}
            </>
          }
          options={
            <>
              <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
              <Select
                value={postDestination}
                onValueChange={(v) => onPostDestinationChange(v as WordPressPostDestination)}
                disabled={workspaceBusy}
              >
                <SelectTrigger className={GENERATOR_SELECT} aria-label="Export destination">
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
            </>
          }
          actions={
            <BulkGeneratorRunActions
              isProcessing={isProcessing}
              canRun={canRun}
              workspaceBusy={workspaceBusy}
              onRun={onRun}
              onCancel={onCancel}
              onClear={onClear}
            />
          }
        />
      }
      detailsPanel={<BulkGeneratorDetailsDrawer {...detailsProps} />}
    />
  );
}
