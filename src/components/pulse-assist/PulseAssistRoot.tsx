import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { useTeam } from "@/contexts/TeamContext";
import { AgentRunsPanel } from "@/components/agent-runs/AgentRunsPanel";
import { PulseAssistChatPanel } from "./PulseAssistChatPanel";
import { PulseAssistSidebarShell } from "./PulseAssistSidebarShell";
import { writeSidebarOpen, writeSidebarPanel } from "@/lib/pulse-assist/storage";
import "@/components/agent-runs/agent-runs-theme.css";

export type PulseAssistLayout = "overlay" | "docked";

export type PulseAssistRootProps = {
  layout?: PulseAssistLayout;
};

export function PulseAssistRoot({ layout = "overlay" }: PulseAssistRootProps) {
  const { sidebarOpen, setSidebarOpen, sidebarPanel, setSidebarPanel } = useAgentRunsContext();

  const setOpen = (next: boolean) => {
    setSidebarOpen(next);
    writeSidebarOpen(next);
  };

  const setPanel = (next: typeof sidebarPanel) => {
    setSidebarPanel(next);
    writeSidebarPanel(next);
  };

  return (
    <PulseAssistSidebarShell
      layout={layout}
      open={sidebarOpen}
      onOpenChange={setOpen}
      panel={sidebarPanel}
      onPanelChange={setPanel}
    >
      {sidebarPanel === "agents" ? (
        <AgentRunsPanel />
      ) : (
        <PulseAssistChatPanel sidebarOpen={sidebarOpen} />
      )}
    </PulseAssistSidebarShell>
  );
}
