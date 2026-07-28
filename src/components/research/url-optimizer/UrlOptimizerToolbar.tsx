import { Download, Loader2, Sparkles, Square, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_ICON_RUN_BTN,
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";

export type UrlOptimizerToolbarProps = {
  running: boolean;
  hasSite: boolean;
  hasCsv: boolean;
  fileName: string | null;
  rowCount: number;
  hasResult: boolean;
  resultRowCount: number;
  onUploadClick: () => void;
  onClearCsv: () => void;
  onOptimize: () => void;
  onCancel: () => void;
  onDownload: () => void;
};

export function UrlOptimizerToolbar({
  running,
  hasSite,
  hasCsv,
  fileName,
  rowCount,
  hasResult,
  resultRowCount,
  onUploadClick,
  onClearCsv,
  onOptimize,
  onCancel,
  onDownload,
}: UrlOptimizerToolbarProps) {
  return (
    <>
      <div
        className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5"
        role="group"
        aria-label="GSC CSV"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_TOOL_BTN}
          disabled={running}
          aria-label="Upload GSC CSV"
          title="Upload GSC CSV"
          onClick={onUploadClick}
        >
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
          GSC CSV
        </Button>
        {fileName ? (
          <span className="max-w-[12rem] truncate text-base text-muted-foreground" title={fileName}>
            {fileName} ({rowCount})
          </span>
        ) : null}
        {hasCsv ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={BULK_HEADER_ICON_TOOL_BTN}
            disabled={running}
            aria-label="Clear uploaded CSV"
            title="Clear uploaded CSV"
            onClick={onClearCsv}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        ) : null}
      </div>

      {hasResult ? (
        <>
          <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={BULK_HEADER_TOOL_BTN}
            disabled={running}
            aria-label={`Download results (${resultRowCount})`}
            title={`Download results (${resultRowCount})`}
            onClick={onDownload}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            ({resultRowCount})
          </Button>
        </>
      ) : null}

      <div
        className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5"
        role="group"
        aria-label="Optimize URLs"
      >
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50"
            aria-label="Cancel"
            title="Cancel"
            onClick={onCancel}
          >
            <Square className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className={BULK_HEADER_ICON_RUN_BTN}
          disabled={running || !hasSite || !hasCsv}
          aria-label="Optimize URLs"
          title="Optimize URLs"
          onClick={onOptimize}
        >
          {running ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </Button>
      </div>
    </>
  );
}
