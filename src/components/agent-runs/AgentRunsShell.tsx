import { useState, type ReactNode } from "react";
import { readAgentRunsSidebarOpen } from "@/lib/agent-runs/storage";
import { AgentRunsContextProvider } from "@/contexts/agent-runs-context";
import { AgentRunsRoot } from "@/components/agent-runs/AgentRunsRoot";
import { useDefaultAgentRunHarnesses } from "@/lib/agent-runs/use-default-agent-run-harnesses";

type AgentRunsShellProps = {
  children: ReactNode;
};

function AgentRunsHarnessBootstrap(): null {
  useDefaultAgentRunHarnesses();
  return null;
}

export function AgentRunsShell({ children }: AgentRunsShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(() => readAgentRunsSidebarOpen());

  return (
    <AgentRunsContextProvider sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
      <AgentRunsHarnessBootstrap />
      {children}
      <AgentRunsRoot />
    </AgentRunsContextProvider>
  );
}
