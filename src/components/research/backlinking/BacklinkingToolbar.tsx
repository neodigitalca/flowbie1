import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import {
  BULK_HEADER_ICON_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";

export type BacklinkingToolbarProps = {
  busy: boolean;
  canRun: boolean;
  onFromGbp: () => void;
  onRun: () => void;
};

export function BacklinkingToolbar({ busy, canRun, onFromGbp, onRun }: BacklinkingToolbarProps) {
  return (
    <GeneratorToolbarFrame
      primary={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_TOOL_BTN}
          disabled={busy || !canRun}
          title="GBP, then pick a niche to run SERP"
          onClick={onFromGbp}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : null}
          From GBP
        </Button>
      }
      actions={
        <Button
          type="button"
          size="sm"
          className={BULK_HEADER_ICON_RUN_BTN}
          disabled={busy || !canRun}
          aria-label="Run backlinking"
          title="Run backlinking"
          onClick={onRun}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </Button>
      }
    />
  );
}
