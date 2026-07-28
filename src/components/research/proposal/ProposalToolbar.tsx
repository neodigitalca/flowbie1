import { type ChangeEvent, type RefObject } from "react";
import { Copy, Download, Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";

export type ProposalToolbarProps = {
  busy: boolean;
  phase: "idle" | "semrush" | "report";
  gridCsvBusy: boolean;
  hasSemrushRows: boolean;
  proposalPackageDisabled: boolean;
  hasCombinedMd: boolean;
  gridCsvFileRef: RefObject<HTMLInputElement | null>;
  onGridCsvFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDownloadGridCsv: () => void;
  onAnalyze: () => void;
  onGenerateProposal: () => void;
  onCopyProposal: () => void;
  onDownloadProposalPackage: () => void;
};

export function ProposalToolbar({
  busy,
  phase,
  gridCsvBusy,
  hasSemrushRows,
  proposalPackageDisabled,
  hasCombinedMd,
  gridCsvFileRef,
  onGridCsvFileChange,
  onDownloadGridCsv,
  onAnalyze,
  onGenerateProposal,
  onCopyProposal,
  onDownloadProposalPackage,
}: ProposalToolbarProps) {
  return (
    <>
      <input
        ref={gridCsvFileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={onGridCsvFileChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={busy}
        aria-label="Upload grid CSV"
        title="Upload grid CSV"
        onClick={() => gridCsvFileRef.current?.click()}
      >
        {gridCsvBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Upload className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Grid CSV
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={busy || !hasSemrushRows}
        aria-label="Download grid CSV export"
        title="Download grid CSV"
        onClick={onDownloadGridCsv}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        Grid CSV export
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={busy}
        onClick={onAnalyze}
      >
        {phase === "semrush" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
        Analyze
      </Button>
      <Button
        type="button"
        size="sm"
        className={BULK_HEADER_RUN_BTN}
        disabled={busy}
        aria-label="Generate proposal"
        title="Includes DataForSEO speed + FAQ audit on up to 10 GSC top pages when connected"
        onClick={onGenerateProposal}
      >
        {phase === "semrush" || phase === "report" ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Proposal
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={proposalPackageDisabled || !hasCombinedMd}
        aria-label="Copy proposal"
        title="Copy strategy .md"
        onClick={onCopyProposal}
      >
        <Copy className="h-4 w-4 shrink-0" aria-hidden />
        Proposal
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={proposalPackageDisabled}
        aria-label="Download proposal package"
        title="Download .md and CSVs"
        onClick={onDownloadProposalPackage}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        Package
      </Button>
    </>
  );
}
