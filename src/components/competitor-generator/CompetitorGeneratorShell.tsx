import React, { useMemo } from "react";
import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";
import { CompetitorAnalysisPanel } from "@/components/competitor-generator/CompetitorAnalysisPanel";
import { SEO_WORKSPACE_SHELL_CLASS } from "@/components/seo/seo-workspace-layout";
import { buildTempLocalAnalysisSite } from "@/lib/temp-local-analysis-site";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import { useManagerSeedWorkspace } from "@/contexts/manager-seed-workspace-context";
import { cn } from "@/lib/utils";

export interface CompetitorGeneratorShellProps {
  apiKey: string;
  dataForSEOApiKey: string;
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  flowPurpose?: string;
  activeSection: BlogGeneratorSectionId;
  onSectionChange: (id: BlogGeneratorSectionId) => void;
}

export const CompetitorGeneratorShell: React.FC<CompetitorGeneratorShellProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const {
    mode: workspaceMode,
    setMode,
    tempSeedUrl,
    setTempSeedUrl,
    canUseConnected,
    enabledSites,
    connectedSite,
    pickTempFromConnected,
  } = useManagerSeedWorkspace();

  const competitorSite = useMemo(() => {
    if (enabledSites.length === 0) {
      return buildTempLocalAnalysisSite(tempSeedUrl);
    }
    if (workspaceMode === "temp") {
      return buildTempLocalAnalysisSite(tempSeedUrl);
    }
    return connectedSite ?? enabledSites[0];
  }, [enabledSites, workspaceMode, tempSeedUrl, connectedSite]);

  const workspaceKey = useMemo(() => {
    if (enabledSites.length === 0) return `temp:${tempSeedUrl}`;
    if (workspaceMode === "temp") return `temp:${tempSeedUrl}`;
    const s = connectedSite ?? enabledSites[0];
    return `connected:${s.id}|${getPublicSiteUrl(s)}`;
  }, [enabledSites, workspaceMode, tempSeedUrl, connectedSite]);

  return (
    <div className={cn(SEO_WORKSPACE_SHELL_CLASS, "min-h-0 gap-0")}>
      <CompetitorAnalysisPanel
        key={workspaceKey}
        site={competitorSite}
        workspace={{
          mode: workspaceMode,
          onModeChange: setMode,
          tempSeedUrl,
          onTempSeedUrlChange: setTempSeedUrl,
          showConnectedToggle: canUseConnected,
          connectedSiteUrl: connectedSite ? getPublicSiteUrl(connectedSite) || null : null,
          onPickTempFromConnected: pickTempFromConnected,
        }}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
    </div>
  );
};
