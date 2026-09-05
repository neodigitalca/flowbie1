import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { cn } from "@/lib/utils";
import { usePulseAssistSidebarResize } from "@/hooks/use-pulse-assist-sidebar-resize";
import { NEO_PULSE_ASSIST_LABEL } from "./PulseAssistBrandTitle";
import { RUNNING_AGENTS_LABEL } from "@/components/agent-runs/AgentRunsBrandTitle";
import { PulseAssistLauncherBrand } from "./PulseAssistLauncherBrand";
import { AgentRunsLauncherBrand } from "@/components/agent-runs/AgentRunsLauncherBrand";
import { PulseAssistSidebarResizeHandle } from "./PulseAssistSidebarResizeHandle";
import { PulseAssistClock } from "./PulseAssistClock";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { PulseAssistLayout } from "./PulseAssistRoot";
import type { SidebarPanel } from "@/lib/pulse-assist/storage";
import "./pulse-assist-theme.css";

type PulseAssistSidebarShellProps = {
  layout?: PulseAssistLayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panel: SidebarPanel;
  onPanelChange: (panel: SidebarPanel) => void;
  children: ReactNode;
};

function ShortcutLaunchers({
  docked,
  onOpenAgents,
  onOpenAssist,
}: {
  docked: boolean;
  onOpenAgents: () => void;
  onOpenAssist: () => void;
}): ReactElement {
  const launcherClass = cn("pulse-assist-launcher", docked && "pulse-assist-launcher--docked");

  const agentsButton = (
    <button
      type="button"
      className={cn(launcherClass, !docked && "neo-pulse-sidebar-launcher--agents")}
      onClick={onOpenAgents}
      aria-label={`Open ${RUNNING_AGENTS_LABEL}`}
      aria-expanded={false}
      aria-controls="neo-pulse-sidebar-panel"
    >
      <AgentRunsLauncherBrand />
    </button>
  );

  const assistButton = (
    <button
      type="button"
      className={launcherClass}
      onClick={onOpenAssist}
      aria-label={`Open ${NEO_PULSE_ASSIST_LABEL}`}
      aria-expanded={false}
      aria-controls="neo-pulse-sidebar-panel"
    >
      <PulseAssistLauncherBrand />
    </button>
  );

  if (docked) {
    return (
      <aside className="pulse-assist-shortcut-rail" aria-label="Sidebar shortcuts">
        {agentsButton}
        {assistButton}
      </aside>
    );
  }

  return (
    <>
      {agentsButton}
      {assistButton}
    </>
  );
}

export function PulseAssistSidebarShell({
  layout = "overlay",
  open,
  onOpenChange,
  panel,
  onPanelChange,
  children,
}: PulseAssistSidebarShellProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const { width, isResizing, isMobile, handleProps } = usePulseAssistSidebarResize(open);
  const panelLabel = panel === "agents" ? RUNNING_AGENTS_LABEL : NEO_PULSE_ASSIST_LABEL;
  const { clearHistory, cancelActiveRuns } = useAgentRunsContext();
  const [clearingHistory, setClearingHistory] = useState(false);
  const [cancellingRuns, setCancellingRuns] = useState(false);
  const docked = layout === "docked";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    document.documentElement.classList.toggle("pulse-assist-scroll-lock", open);
    document.body.classList.toggle("pulse-assist-scroll-lock", open);
    return () => {
      document.documentElement.classList.remove("pulse-assist-scroll-lock");
      document.body.classList.remove("pulse-assist-scroll-lock");
    };
  }, [open]);

  const openPanel = (next: SidebarPanel) => {
    onPanelChange(next);
    onOpenChange(true);
  };

  return (
    <div
      className={cn(
        "fai-sidebar-root fai-sidebar-root--right pulse-assist-root",
        docked && "pulse-assist-root--docked",
        open && "fai-sidebar-root--open pulse-assist-root--open",
        isResizing && "pulse-assist-root--resizing",
      )}
      style={{ "--fai-sidebar-width": `${width}px` } as CSSProperties}
      aria-hidden={docked ? false : !open}
    >
      {!open ? (
        <ShortcutLaunchers
          docked={docked}
          onOpenAgents={() => openPanel("agents")}
          onOpenAssist={() => openPanel("assist")}
        />
      ) : null}

      <button
        type="button"
        className={cn("fai-sidebar-backdrop", open && "fai-sidebar-backdrop--visible")}
        onClick={() => onOpenChange(false)}
        aria-label="Close sidebar"
        tabIndex={open ? 0 : -1}
      />

      <div
        id="neo-pulse-sidebar-panel"
        ref={panelRef}
        className={cn("fai-sidebar-panel pulse-assist-panel", open && "fai-sidebar-panel--open")}
        role="dialog"
        aria-modal="true"
        aria-label={panelLabel}
      >
        {open ? (
          <button
            type="button"
            className="pulse-assist-panel-close-tab"
            onClick={() => onOpenChange(false)}
            aria-label="Close sidebar"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {open && !isMobile ? <PulseAssistSidebarResizeHandle {...handleProps} /> : null}
        {open ? (
          <div
            className="pulse-assist-panel-tablist flex min-h-[2.75rem] min-w-0 shrink-0 items-center gap-1 bg-black px-3 py-2"
            role="tablist"
            aria-label="Sidebar panel"
          >
            <WorkspacePill
              label="Assist"
              active={panel === "assist"}
              square
              onClick={() => onPanelChange("assist")}
              className="h-8 min-w-[4.5rem] shrink-0"
            />
            <WorkspacePill
              label="Agents"
              active={panel === "agents"}
              square
              onClick={() => onPanelChange("agents")}
              className="h-8 min-w-[4.5rem] shrink-0"
            />
            <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
              <PulseAssistClock className="min-w-0" />
              {panel === "agents" ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 shrink-0 px-2 text-base font-semibold text-foreground hover:text-foreground"
                    disabled={cancellingRuns || clearingHistory}
                    onClick={() => {
                      setCancellingRuns(true);
                      void cancelActiveRuns().finally(() => setCancellingRuns(false));
                    }}
                  >
                    {cancellingRuns ? "Cancelling…" : "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 shrink-0 px-2 text-base font-semibold text-foreground hover:text-foreground"
                    disabled={clearingHistory || cancellingRuns}
                    onClick={() => {
                      setClearingHistory(true);
                      void clearHistory().finally(() => setClearingHistory(false));
                    }}
                  >
                    {clearingHistory ? "Clearing…" : "Clear all"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
