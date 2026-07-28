import { Download, Loader2, Sparkles, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { SitemapLegacyRedirectWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-legacy-redirect-workspace-bindings";
import { cn } from "@/lib/utils";

const HEADER_TOOL_BTN = BULK_HEADER_TOOL_BTN;
const HEADER_CANCEL_BTN =
  "h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50 hover:text-red-400";

export type SitemapLegacyToolbarProps = SitemapLegacyRedirectWorkspaceBindings;

export function SitemapLegacyToolbar({
  generating,
  hasSheet,
  onUploadClick,
  onGenerate,
  onCancel,
  onDownloadCsv,
  canDownloadCsv,
}: SitemapLegacyToolbarProps) {
  const workspaceBusy = generating;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={HEADER_TOOL_BTN}
        disabled={workspaceBusy}
        aria-label="Upload sheet"
        title="Upload sheet"
        onClick={onUploadClick}
      >
        <Upload className="h-4 w-4 shrink-0" aria-hidden />
        Sheet
      </Button>
      <Button
        type="button"
        size="sm"
        className={cn(BULK_HEADER_RUN_BTN, "gap-1.5")}
        disabled={workspaceBusy || !hasSheet}
        aria-label={generating ? "Generating redirects" : "Generate redirects"}
        title={generating ? "Generating redirects" : "Generate redirects"}
        onClick={onGenerate}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Redirects
      </Button>
      {generating ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={HEADER_CANCEL_BTN}
          aria-label="Cancel"
          title="Cancel"
          onClick={onCancel}
        >
          <Square className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      ) : null}
      {canDownloadCsv ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_TOOL_BTN}
          aria-label="Download CSV"
          title="Download CSV"
          onClick={onDownloadCsv}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          CSV
        </Button>
      ) : null}
    </>
  );
}
