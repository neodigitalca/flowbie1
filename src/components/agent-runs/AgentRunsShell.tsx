import { useState, type ReactNode } from "react";
import { readSidebarPanel, type SidebarPanel } from "@/lib/pulse-assist/storage";
import { AgentRunsContextProvider } from "@/contexts/agent-runs-context";
import { useDefaultAgentRunHarnesses } from "@/lib/agent-runs/use-default-agent-run-harnesses";

type AgentRunsShellProps = {
  children: ReactNode;
};

function AgentRunsHarnessBootstrap(): null {
  useDefaultAgentRunHarnesses();
  return null;
}

export function AgentRunsShell({ children }: AgentRunsShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>(() => readSidebarPanel());

  return (
    <AgentRunsContextProvider
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      sidebarPanel={sidebarPanel}
      setSidebarPanel={setSidebarPanel}
    >
      <AgentRunsHarnessBootstrap />
      {children}
    </AgentRunsContextProvider>
  );
}
