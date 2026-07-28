import { useCallback } from "react";
import {
  ClipboardList,
  Copy,
  Download,
  FileText,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KB_FILES_STORAGE_KEY, type StoredFile } from "@/components/integrations/types";
import {
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COULD_NOT_COPY, NOTIFY_DOWNLOADED_MARKDOWN_FILE, NOTIFY_GENERATE_A_REPORT_FIRST, NOTIFY_MARKDOWN_COPIED, NOTIFY_REPORT_ADDED_TO_KNOWLEDGE_BASE } from "@/lib/notify-messages";
import type { FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";
import { triggerBlobDownload } from "@/components/manager/flow-freeform/flow-freeform-clarify-utils";

export type FlowFreeformToolbarProps = {
  flowTitle: string;
  finalMarkdown: string;
  hasGoalPrompt: boolean;
  sectionsCount: number;
  pipelineBusy: boolean;
  onRunClarify: () => void;
  onRunOutline: () => void;
  onRunFullReport: () => void;
  onRunAllSections: () => void;
  onAbort: () => void;
  onResetBlueprint?: () => void;
};

export function FlowFreeformToolbar({
  flowTitle,
  finalMarkdown,
  hasGoalPrompt,
  sectionsCount,
  pipelineBusy,
  onRunClarify,
  onRunOutline,
  onRunFullReport,
  onRunAllSections,
  onAbort,
  onResetBlueprint,
}: FlowFreeformToolbarProps) {
  const hasReport = finalMarkdown.trim().length > 0;

  const copyMarkdown = useCallback(async () => {
    if (!finalMarkdown.trim()) return;
    try {
      await navigator.clipboard.writeText(finalMarkdown.trim());
      notify.success(NOTIFY_MARKDOWN_COPIED);
    } catch {
      notify.error(NOTIFY_COULD_NOT_COPY);
    }
  }, [finalMarkdown]);

  const downloadMarkdown = useCallback(() => {
    if (!finalMarkdown.trim()) {
      notify.error(NOTIFY_GENERATE_A_REPORT_FIRST);
      return;
    }
    const slug = (flowTitle || "flow-report").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
    triggerBlobDownload(finalMarkdown.trim(), `flow-report-${slug}-${Date.now()}.md`, "text/markdown;charset=utf-8");
    notify.success(NOTIFY_DOWNLOADED_MARKDOWN_FILE);
  }, [finalMarkdown, flowTitle]);

  const addReportToKb = useCallback(() => {
    if (!finalMarkdown.trim()) return;
    const ts = Date.now();
    const safe = (flowTitle || "flow-report").replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase() || "flow-report";
    const newFile: StoredFile = {
      name: `flow-report-${safe}-${ts}.md`,
      size: finalMarkdown.length,
      content: finalMarkdown,
      starred: false,
      timestamp: ts,
    };
    const stored = localStorage.getItem(KB_FILES_STORAGE_KEY) || "[]";
    const existing = JSON.parse(stored) as StoredFile[];
    const all = [...existing, newFile];
    localStorage.setItem(KB_FILES_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("kb-files-updated", { detail: { files: all } }));
    notify.success(NOTIFY_REPORT_ADDED_TO_KNOWLEDGE_BASE);
  }, [finalMarkdown, flowTitle]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={pipelineBusy}
        title="Ask the model for optional multiple-choice clarifications"
        onClick={() => void onRunClarify()}
      >
        {pipelineBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <MessageCircleQuestion className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Clarify
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={pipelineBusy || !hasGoalPrompt}
        title="Build section outline from your goal"
        onClick={() => void onRunOutline()}
      >
        {pipelineBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Outline
      </Button>
      <Button
        type="button"
        size="sm"
        className={BULK_HEADER_RUN_BTN}
        disabled={pipelineBusy || !hasGoalPrompt}
        title="Clarify, outline, then write all sections"
        onClick={() => void onRunFullReport()}
      >
        {pipelineBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Report
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={pipelineBusy || sectionsCount === 0}
        title="Write or rewrite all sections from the current outline"
        onClick={() => void onRunAllSections()}
      >
        {pipelineBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Sections
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={!hasReport}
        aria-label="Copy Markdown"
        title="Copy Markdown"
        onClick={() => void copyMarkdown()}
      >
        <Copy className="h-4 w-4 shrink-0" aria-hidden />
        Markdown
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={!hasReport}
        aria-label="Download Markdown"
        title="Download Markdown"
        onClick={downloadMarkdown}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden />
        Markdown
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        disabled={!hasReport}
        title="Append stitched report to the knowledge base"
        onClick={addReportToKb}
      >
        Knowledge base
      </Button>
      {pipelineBusy ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          aria-label="Cancel"
          title="Cancel"
          onClick={onAbort}
        >
          <X className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      ) : null}
      {onResetBlueprint ? (
        <>
          <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
          <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={BULK_HEADER_TOOL_BTN}
              onClick={onResetBlueprint}
            >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
                Reset blueprint
              </Button>
          </div>
        </>
      ) : null}
    </>
  );
}
