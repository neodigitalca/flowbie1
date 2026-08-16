import { Download, Sparkles, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { ContentCreatorToolbarCsvMenu } from "@/components/social/content-creator/ContentCreatorToolbarCsvMenu";
import { OverviewContentSortControls } from "@/components/overview/overview-tab/OverviewContentSortControls";
import {
  clampContentPostCount,
  CONTENT_POST_COUNT_MAX,
  CONTENT_POST_COUNT_MIN,
  type ContentCreatorGenerateConfig,
} from "@/lib/social/content-creator-types";
import type { ContentCreatorWorkspaceController } from "@/hooks/social/use-content-creator-workspace";
import { cn } from "@/lib/utils";

export type ContentCreatorGenerateToolbarProps = {
  ctrl: ContentCreatorWorkspaceController;
  disabled?: boolean;
};

const TOOLBAR_NUM_INPUT = cn(
  BULK_HEADER_FIELD,
  "h-8 w-[3.75rem] min-w-[3.75rem] shrink-0 px-2 text-right tabular-nums",
);

export function ContentCreatorGenerateToolbar({ ctrl, disabled = false }: ContentCreatorGenerateToolbarProps) {
  const {
    generateConfig,
    setGenerateConfig,
    handleGenerateRows,
    handleCancelGenerate,
    handleImportCsv,
    handleClearAllRows,
    handleExportCsv,
    canExportCsv,
    isGenerating,
    sortColumn,
    setSortColumn,
    sortDir,
    setSortDir,
    displayRows,
  } = ctrl;
  const configToolbarDisabled = disabled || isGenerating;

  const patchConfig = (patch: Partial<ContentCreatorGenerateConfig>) => {
    setGenerateConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      <div className={cn(BULK_HEADER_TOOL_BTN, "flex items-center gap-1 px-2")}>
        <label htmlFor="content-creator-toolbar-posts" className="shrink-0 text-base text-muted-foreground">
          Posts
        </label>
        <input
          id="content-creator-toolbar-posts"
          type="number"
          min={CONTENT_POST_COUNT_MIN}
          max={CONTENT_POST_COUNT_MAX}
          value={generateConfig.postCount}
          disabled={configToolbarDisabled}
          className={TOOLBAR_NUM_INPUT}
          aria-label="Posts to generate"
          onChange={(e) =>
            patchConfig({
              postCount: clampContentPostCount(Number(e.target.value) || CONTENT_POST_COUNT_MIN),
            })
          }
        />
      </div>

      <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

      <ContentCreatorToolbarCsvMenu disabled={configToolbarDisabled} onImportCsv={handleImportCsv} />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <OverviewContentSortControls
          sortColumn={sortColumn}
          sortDir={sortDir}
          setSortColumn={setSortColumn}
          setSortDir={setSortDir}
          disabled={disabled || displayRows.length === 0}
          titleSortLabel="Keyword"
          showDateSort={false}
        />
        <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          disabled={configToolbarDisabled}
          aria-label="Clear all posts"
          title="Clear all posts"
          onClick={handleClearAllRows}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          disabled={disabled || !canExportCsv}
          aria-label="Export calendar CSV"
          title="Export calendar CSV"
          onClick={handleExportCsv}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
        </Button>

        {isGenerating ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50"
            aria-label="Cancel"
            title="Cancel"
            onClick={handleCancelGenerate}
          >
            <Square className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}

        <Button
          type="button"
          className={cn(BULK_HEADER_RUN_BTN, "shrink-0 gap-1.5")}
          disabled={configToolbarDisabled}
          onClick={() => void handleGenerateRows()}
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Generate
        </Button>
      </div>
    </div>
  );
}
