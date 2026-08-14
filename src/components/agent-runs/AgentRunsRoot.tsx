import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { writeAgentRunsSidebarOpen } from "@/lib/agent-runs/storage";
import { AgentRunsPanel } from "./AgentRunsPanel";
import { AgentRunsSidebarShell } from "./AgentRunsSidebarShell";

export function AgentRunsRoot() {
  const { sidebarOpen, setSidebarOpen } = useAgentRunsContext();

  const setOpen = (next: boolean) => {
    setSidebarOpen(next);
    writeAgentRunsSidebarOpen(next);
  };

  return (
    <AgentRunsSidebarShell open={sidebarOpen} onOpenChange={setOpen}>
      <AgentRunsPanel />
    </AgentRunsSidebarShell>
  );
}
