import { CircleHelp, Download, Trash2 } from "lucide-react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { AssistTargetScope } from "@/lib/pulse-assist/types";
import { PulseAssistBrandTitle } from "./PulseAssistBrandTitle";

type PulseAssistPanelHeaderProps = {
  targetScope: AssistTargetScope;
  onTargetScopeChange: (scope: AssistTargetScope) => void;
  onCreateTicket: () => void;
  onDownloadDebug: () => void;
  onClearHistory: () => void;
  hidePageScope?: boolean;
};

export function PulseAssistPanelHeader({
  targetScope,
  onTargetScopeChange,
  onCreateTicket,
  onDownloadDebug,
  onClearHistory,
  hidePageScope = false,
}: PulseAssistPanelHeaderProps) {
  const scopeOptions = hidePageScope ? (["site"] as const) : (["page", "site"] as const);

  return (
    <div className="pulse-assist-panel-header">
      <div className="pulse-assist-panel-header__row">
        <PulseAssistBrandTitle
          stacked={false}
          markSize={20}
          className="pulse-assist-panel-header__title shrink-0"
        />
        <div className="pulse-assist-panel-header__scope" role="group" aria-label="Assist scope">
          {scopeOptions.map((scope) => (
            <WorkspacePill
              key={scope}
              label={scope === "page" ? "Page" : "Site"}
              active={targetScope === scope}
              square
              onClick={() => onTargetScopeChange(scope)}
            />
          ))}
        </div>
        <div className="pulse-assist-panel-header__actions">
          <button
            type="button"
            className="pulse-assist-panel-header__icon-btn"
            onClick={onCreateTicket}
            aria-label="Create a ticket"
          >
            <CircleHelp className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="pulse-assist-panel-header__icon-btn"
            onClick={onDownloadDebug}
            aria-label="Download debug log"
          >
            <Download className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="pulse-assist-panel-header__icon-btn"
            onClick={onClearHistory}
            aria-label="Clear chat history"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
