import { Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_RUN_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { cn } from "@/lib/utils";

export type CitationToolbarProps = {
  busy: boolean;
  canGenerate: boolean;
  canCopy: boolean;
  seedKeyword: string;
  onSeedKeywordChange: (value: string) => void;
  onGenerate: () => void;
  onCopy: () => void;
};

export function CitationToolbar({
  busy,
  canGenerate,
  canCopy,
  seedKeyword,
  onSeedKeywordChange,
  onGenerate,
  onCopy,
}: CitationToolbarProps) {
  return (
    <>
      <Input
        id="citation-keyword"
        aria-label="Keyword"
        value={seedKeyword}
        onChange={(e) => onSeedKeywordChange(e.target.value)}
        placeholder="Keyword"
        disabled={busy}
        className={cn(BULK_HEADER_FIELD, "h-8 w-[min(100%,12rem)] shrink-0 px-2")}
      />
      <Button
        type="button"
        size="sm"
        className={BULK_HEADER_RUN_BTN}
        disabled={busy || !canGenerate}
        aria-label="Generate citation"
        title="Generate citation"
        onClick={onGenerate}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Citation
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_ICON_TOOL_BTN}
        disabled={!canCopy || busy}
        aria-label="Copy citation"
        title="Copy citation"
        onClick={onCopy}
      >
        <Copy className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
    </>
  );
}
