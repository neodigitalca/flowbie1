import { useRef } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Square,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { SitemapOptimizerCollectionOption } from "@/lib/sitemap-optimizer/collection-options";
import {
  SITEMAP_OPTIMIZER_REDIRECT_MAP_TEMPLATE_LABEL,
  SITEMAP_OPTIMIZER_UPLOAD_GSC_CSV_LABEL,
  SITEMAP_OPTIMIZER_UPLOAD_RANK_MATH_LABEL,
  sitemapOptimizerAnalyzeButtonLabel,
} from "@/lib/sitemap-optimizer/sitemap-optimizer-toolbar-copy";
import type { SitemapOptimizerCollectionKey } from "@/lib/sitemap-optimizer/types";
import { cn } from "@/lib/utils";

const HEADER_TOOL_BTN = BULK_HEADER_TOOL_BTN;
const HEADER_CANCEL_BTN =
  "h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50 hover:text-red-400";

export type SitemapPlanToolbarProps = {
  busy: boolean;
  workspaceBusy: boolean;
  showToolbarOptions: boolean;
  showSetupToolbar: boolean;
  showResultToolbar: boolean;
  showAnalyzeAction: boolean;
  showGscCsvUpload: boolean;
  showRankMathUpload: boolean;
  inPublishWorkspace: boolean;
  isGridHarness: boolean;
  isGridFlow: boolean;
  isRedirectMapHarness: boolean;
  hasResult: boolean;
  siteReady: boolean;
  workspaceMode: string;
  siteConnected: boolean;
  approving: boolean;
  rankMathImportRunning: boolean;
  mergeGroupCount: number;
  collectionOptions: SitemapOptimizerCollectionOption[];
  selected: Set<SitemapOptimizerCollectionKey>;
  selectCollection: (key: SitemapOptimizerCollectionKey) => void;
  gscFileName: string | null;
  gscUploadRowCount: number | null | undefined;
  resultRowCount: number;
  resultContentSheetCount: number;
  onDownloadRedirectMapTemplate: () => void;
  onGscFile: (file: File) => void | Promise<void>;
  onRankMathFile: (file: File) => void | Promise<void>;
  onClearGscUpload: () => void;
  onAnalyze: () => void | Promise<void>;
  onCancel: () => void;
  onBackToMergePlan: () => void;
  onApprovePlan: () => void;
  onDownloadRedirects: () => void;
  onExportContentSheetCsv: () => void;
  onCopyReport: () => void | Promise<void>;
};

export function SitemapPlanToolbar(props: SitemapPlanToolbarProps) {
  const rankMathFileRef = useRef<HTMLInputElement>(null);
  const gscFileRef = useRef<HTMLInputElement>(null);

  return (
  <>
    <input
      ref={gscFileRef}
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      disabled={props.busy}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void props.onGscFile(file);
        e.target.value = "";
      }}
    />
    <input
      ref={rankMathFileRef}
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      disabled={props.busy || props.workspaceMode === "temp" || !props.siteConnected}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void props.onRankMathFile(file);
        e.target.value = "";
      }}
    />
    {props.showToolbarOptions ? (
      <>
        {props.showGscCsvUpload ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.busy}
            aria-label="Upload GSC CSV"
            title="Upload GSC CSV"
            onClick={() => gscFileRef.current?.click()}
          >
            <Upload className="h-4 w-4 shrink-0" />
            {SITEMAP_OPTIMIZER_UPLOAD_GSC_CSV_LABEL}
          </Button>
        ) : null}
        {props.showRankMathUpload ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.busy}
            aria-label="Upload Rank Math plan"
            title="Upload Rank Math plan"
            onClick={() => rankMathFileRef.current?.click()}
          >
            {props.rankMathImportRunning ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 shrink-0" />
            )}
            {SITEMAP_OPTIMIZER_UPLOAD_RANK_MATH_LABEL}
          </Button>
        ) : null}
        {!props.busy && !props.inPublishWorkspace ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.busy}
            title="Download redirect map template"
            onClick={props.onDownloadRedirectMapTemplate}
          >
            {SITEMAP_OPTIMIZER_REDIRECT_MAP_TEMPLATE_LABEL}
          </Button>
        ) : null}
        {props.showAnalyzeAction ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={
              props.isGridHarness
                ? !props.gscUploadRowCount
                : props.workspaceMode === "temp" || !props.siteConnected
            }
            aria-label={
              props.isGridHarness
                ? "Analyze grid"
                : sitemapOptimizerAnalyzeButtonLabel({
                    isGridHarness: props.isGridHarness,
                    hasResult: props.hasResult,
                  })
            }
            onClick={() => void props.onAnalyze()}
          >
            {sitemapOptimizerAnalyzeButtonLabel({
              isGridHarness: props.isGridHarness,
              hasResult: props.hasResult,
            })}
          </Button>
        ) : null}
      </>
    ) : null}
    {props.showSetupToolbar && props.gscFileName ? (
      <span className="shrink-0 text-base text-muted-foreground">
        {props.gscFileName} ({props.gscUploadRowCount ?? 0} rows
        {props.isRedirectMapHarness ? " · redirect map" : ""})
      </span>
    ) : null}
    {props.showSetupToolbar && props.gscUploadRowCount ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_ICON_TOOL_BTN}
        disabled={props.busy}
        aria-label="Clear uploaded file"
        title="Clear uploaded file"
        onClick={props.onClearGscUpload}
      >
        <X className="h-4 w-4" />
      </Button>
    ) : null}
    {props.busy ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={HEADER_CANCEL_BTN}
        aria-label="Cancel"
        title="Cancel"
        onClick={props.onCancel}
      >
        <Square className="h-4 w-4 shrink-0" />
      </Button>
    ) : null}
    {props.inPublishWorkspace && !props.busy ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={HEADER_TOOL_BTN}
        onClick={props.onBackToMergePlan}
      >
        Back to merge plan
      </Button>
    ) : null}
    {props.showResultToolbar && !props.isGridFlow && props.mergeGroupCount > 0 && props.siteReady ? (
      <Button
        type="button"
        className={cn("flowbie-btn-semantic-publish h-8 shrink-0 gap-1.5 px-2.5 text-base shadow-none")}
        disabled={props.approving}
        aria-label="Approve plan"
        title="Approve plan"
        onClick={props.onApprovePlan}
      >
        {props.approving ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        )}
        Plan
      </Button>
    ) : null}
    {props.showResultToolbar && props.isGridFlow ? (
      <>
        {props.resultRowCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.approving}
            aria-label="Download redirects"
            title="Download redirects"
            onClick={props.onDownloadRedirects}
          >
            <Download className="h-4 w-4 shrink-0" />
            Redirects
          </Button>
        ) : null}
        {props.resultContentSheetCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.approving}
            aria-label="Export content sheet"
            title="Export content sheet"
            onClick={props.onExportContentSheetCsv}
          >
            Content sheet
          </Button>
        ) : null}
      </>
    ) : null}
    {props.showResultToolbar && !props.isGridFlow ? (
      <>
        {props.resultRowCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.approving}
            aria-label="Download redirects"
            title="Download redirects"
            onClick={props.onDownloadRedirects}
          >
            <Download className="h-4 w-4 shrink-0" />
            Redirects
          </Button>
        ) : null}
        {props.resultContentSheetCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={HEADER_TOOL_BTN}
            disabled={props.approving}
            aria-label="Export content sheet"
            title="Export content sheet"
            onClick={props.onExportContentSheetCsv}
          >
            Content sheet
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_TOOL_BTN}
          onClick={() => void props.onCopyReport()}
          aria-label="Copy report"
          title="Copy report"
        >
          <Copy className="h-4 w-4 shrink-0" />
          Report
        </Button>
      </>
    ) : null}
  </>
  );
}
