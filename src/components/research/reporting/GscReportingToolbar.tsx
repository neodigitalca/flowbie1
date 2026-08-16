import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import { GeneratorToolbarOptionsFlyout } from "@/components/blog-generator/GeneratorToolbarOptionsFlyout";
import { GscReportingComparePopover } from "@/components/research/reporting/GscReportingComparePopover";
import { GscReportingRunActions } from "@/components/research/reporting/GscReportingRunActions";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
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
    <GeneratorToolbarFrame
      options={
        <GscReportingComparePopover
          busy={busy}
          gscFetchPreset={gscFetchPreset}
          onGscFetchPresetChange={onGscFetchPresetChange}
          compareRangeDraft={compareRangeDraft}
          onCompareRangeDraftChange={onCompareRangeDraftChange}
          todayYmdMax={todayYmdMax}
        />
      }
      primary={
        <GeneratorToolbarOptionsFlyout disabled={busy || !hasReport} label="Export">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={BULK_HEADER_TOOL_BTN}
              disabled={!hasReport || busy}
              onClick={onCopyMarkdown}
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copy report
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={BULK_HEADER_TOOL_BTN}
              disabled={!hasReport || busy}
              onClick={onDownloadMarkdown}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Download report
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={BULK_HEADER_TOOL_BTN}
              disabled={!hasReport || busy}
              onClick={onExportKb}
            >
              Knowledge base
            </Button>
          </div>
        </GeneratorToolbarOptionsFlyout>
      }
      actions={
        <GscReportingRunActions busy={busy} onGenerate={onGenerate} onCancel={onCancel} />
      }
    />
  );
}
