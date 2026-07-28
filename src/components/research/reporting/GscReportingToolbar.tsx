import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GscReportingComparePopover } from "@/components/research/reporting/GscReportingComparePopover";
import { GscReportingRunActions } from "@/components/research/reporting/GscReportingRunActions";
import {
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { GscCompareRanges, GscReportingComparePresetId } from "@/lib/gsc-reporting/gsc-fetch-date-presets";

export type GscReportingToolbarProps = {
  busy: boolean;
  gscFetchPreset: GscReportingComparePresetId;
  onGscFetchPresetChange: (preset: GscReportingComparePresetId) => void;
  compareRangeDraft: GscCompareRanges;
  onCompareRangeDraftChange: (updater: (prev: GscCompareRanges) => GscCompareRanges) => void;
  todayYmdMax: string;
  hasReport: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onExportKb: () => void;
};

export function GscReportingToolbar({
  busy,
  gscFetchPreset,
  onGscFetchPresetChange,
  compareRangeDraft,
  onCompareRangeDraftChange,
  todayYmdMax,
  hasReport,
  onGenerate,
  onCancel,
  onCopyMarkdown,
  onDownloadMarkdown,
  onExportKb,
}: GscReportingToolbarProps) {
  return (
    <>
      <div role="group" aria-label="Compare periods">
        <GscReportingComparePopover
          busy={busy}
          gscFetchPreset={gscFetchPreset}
          onGscFetchPresetChange={onGscFetchPresetChange}
          compareRangeDraft={compareRangeDraft}
          onCompareRangeDraftChange={onCompareRangeDraftChange}
          todayYmdMax={todayYmdMax}
        />
      </div>

      <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

      <div
        className="flex shrink-0 flex-nowrap items-center gap-1.5"
        role="group"
        aria-label="Export report"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          disabled={!hasReport || busy}
          aria-label="Copy report"
          title="Copy full stitched Markdown report"
          onClick={onCopyMarkdown}
        >
          <Copy className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          disabled={!hasReport || busy}
          aria-label="Download report"
          title="Download stitched Markdown file"
          onClick={onDownloadMarkdown}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_TOOL_BTN}
          disabled={!hasReport || busy}
          title="Add report to knowledge base"
          onClick={onExportKb}
        >
          Knowledge base
        </Button>
      </div>

      <GscReportingRunActions busy={busy} onGenerate={onGenerate} onCancel={onCancel} />
    </>
  );
}
