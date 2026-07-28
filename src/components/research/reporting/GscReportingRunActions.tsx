import { ClipboardList, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BULK_HEADER_ICON_RUN_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";

export type GscReportingRunActionsProps = {
  busy: boolean;
  onGenerate: () => void;
  onCancel: () => void;
};

export function GscReportingRunActions({ busy, onGenerate, onCancel }: GscReportingRunActionsProps) {
  return (
    <div
      className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5"
      role="group"
      aria-label="Generate report"
    >
      {busy ? (
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
      ) : (
        <Button
          type="button"
          size="sm"
          className={BULK_HEADER_ICON_RUN_BTN}
          aria-label="Generate report"
          title="Generate report"
          onClick={onGenerate}
        >
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      )}
    </div>
  );
}
