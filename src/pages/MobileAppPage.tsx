import { AgentRunsShell } from "@/components/agent-runs/AgentRunsShell";
import { MobileTeamWorkspaceHydrate } from "@/components/mobile-app/MobileTeamWorkspaceHydrate";
import { MobileAppShell } from "@/components/mobile-app/MobileAppShell";
import { PulseAssistContextProvider } from "@/contexts/pulse-assist-context";
import { ChatPreferencesProvider } from "@/contexts/ChatPreferencesContext";
import { MobilePushProvider } from "@/contexts/MobilePushContext";

export default function MobileAppPage() {
  return (
    <AgentRunsShell>
      <PulseAssistContextProvider managerTab="mobile" managerDashboardCluster="properties">
        <ChatPreferencesProvider>
          <MobilePushProvider>
            <MobileTeamWorkspaceHydrate />
            <MobileAppShell />
          </MobilePushProvider>
        </ChatPreferencesProvider>
      </PulseAssistContextProvider>
    </AgentRunsShell>
  );
}
