import { useCallback, useEffect, useMemo, useState } from "react";
import { AiModelsSettingsContent } from "@/components/manager/AiModelsSettingsContent";
import { ApiKeysSettingsContent } from "@/components/manager/ApiKeysSettingsContent";
import { GoogleServicesSettingsContent } from "@/components/manager/GoogleServicesSettingsContent";
import { WpEngineSettingsContent } from "@/components/manager/WpEngineSettingsContent";
import { ManagerMasterRulesSettingsContent } from "@/components/manager/ManagerMasterRulesSettingsContent";
import { IntegrationsTab } from "@/components/IntegrationsTab";
import { PropertiesDashboardChromeProvider } from "@/components/manager/dashboard/PropertiesDashboardChromeContext";
import { ManagerDashboardShell } from "@/components/manager/dashboard/ManagerDashboardShell";
import {
  type ManagerSettingsClusterId,
  readStoredManagerSettingsCluster,
  writeStoredManagerSettingsCluster,
} from "@/components/manager/manager-settings-cluster";
import { dashboardClusterToArea, useTeamPermission } from "@/hooks/use-team-permission";
import { DASHBOARD_SECTION_ORDER } from "@/components/manager/dashboard/dashboard-section-labels";

export interface ManagerSettingsContentProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  saveApiKey: (key: string) => void;
  dataForSEOApiKey: string;
  setDataForSEOApiKey: (key: string) => void;
  saveDataForSEOApiKeyToStorage: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  maxTokens: number;
  setMaxTokens: (value: number) => void;
  topP: number;
  setTopP: (value: number) => void;
  settingsCluster?: ManagerSettingsClusterId;
  onSettingsClusterChange?: (id: ManagerSettingsClusterId) => void;
}

export function ManagerSettingsContent({
  apiKey,
  setApiKey,
  saveApiKey,
  dataForSEOApiKey,
  setDataForSEOApiKey,
  saveDataForSEOApiKeyToStorage,
  selectedModel,
  setSelectedModel,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
  topP,
  setTopP,
  settingsCluster: settingsClusterControlled,
  onSettingsClusterChange,
}: ManagerSettingsContentProps) {
  const [internalCluster, setInternalCluster] = useState<ManagerSettingsClusterId>(() =>
    readStoredManagerSettingsCluster(),
  );

  const cluster =
    settingsClusterControlled !== undefined ? settingsClusterControlled : internalCluster;

  const { canRead } = useTeamPermission();

  const onClusterChange = useCallback(
    (id: ManagerSettingsClusterId) => {
      if (onSettingsClusterChange) {
        onSettingsClusterChange(id);
      } else {
        setInternalCluster(id);
      }
    },
    [onSettingsClusterChange],
  );

  const visibleSectionIds = useMemo(
    () =>
      DASHBOARD_SECTION_ORDER.filter((id) => {
        const area = dashboardClusterToArea(id);
        return !area || canRead(area);
      }),
    [canRead],
  );

  useEffect(() => {
    if (!visibleSectionIds.includes(cluster) && visibleSectionIds.length > 0) {
      onClusterChange(visibleSectionIds[0]);
    }
  }, [cluster, visibleSectionIds, onClusterChange]);

  useEffect(() => {
    writeStoredManagerSettingsCluster(cluster);
  }, [cluster]);

  const handleDataForSEOSave = useCallback(
    (key: string) => {
      setDataForSEOApiKey(key);
      saveDataForSEOApiKeyToStorage(key);
    },
    [setDataForSEOApiKey, saveDataForSEOApiKeyToStorage],
  );

  const sections = [
    {
      id: "properties" as const,
      content: <IntegrationsTab />,
    },
    {
      id: "api-keys" as const,
      content: (
        <ApiKeysSettingsContent
          apiKey={apiKey}
          setApiKey={setApiKey}
          saveApiKey={saveApiKey}
          dataForSEOApiKey={dataForSEOApiKey}
          setDataForSEOApiKey={setDataForSEOApiKey}
          saveDataForSEOApiKey={handleDataForSEOSave}
          selectedModel={selectedModel}
          temperature={temperature}
          maxTokens={maxTokens}
          topP={topP}
        />
      ),
    },
    {
      id: "master-rules" as const,
      content: <ManagerMasterRulesSettingsContent />,
    },
    {
      id: "ai-generation" as const,
      content: (
        <AiModelsSettingsContent
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          temperature={temperature}
          setTemperature={setTemperature}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          topP={topP}
          setTopP={setTopP}
        />
      ),
    },
    {
      id: "google" as const,
      content: <GoogleServicesSettingsContent />,
    },
    {
      id: "wp-engine" as const,
      content: <WpEngineSettingsContent />,
    },
  ];

  return (
    <PropertiesDashboardChromeProvider>
      <ManagerDashboardShell
        activeSection={cluster}
        onSectionChange={onClusterChange}
        sections={sections
          .filter(({ id }) => visibleSectionIds.includes(id))
          .map(({ id, content }) => ({ id, content }))}
        visibleSectionIds={visibleSectionIds}
      />
    </PropertiesDashboardChromeProvider>
  );
}
