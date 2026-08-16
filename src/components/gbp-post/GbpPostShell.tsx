import React, { useMemo } from "react";
import { GbpPostPropertyPanel } from "@/components/integrations/wordpress/GbpPostPropertyPanel";
import { useManagerSeedWorkspace } from "@/contexts/manager-seed-workspace-context";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { buildTempLocalAnalysisSite } from "@/lib/temp-local-analysis-site";
import { getCyberpunkTextClasses } from "@/components/integrations/wordpress/cyberpunk-theme";
import { SEO_WORKSPACE_SHELL_CLASS } from "@/components/seo/seo-workspace-layout";
import type { SocialPlatformTab } from "@/components/social/SocialPlatformPills";

export type GbpPostShellProps = {
  onPlatformChange?: (tab: SocialPlatformTab) => void;
};

/**
 * SEO mega menu workspace for Google Business Profile posting (connected site).
 */
export const GbpPostShell: React.FC<GbpPostShellProps> = ({ onPlatformChange }) => {
  const { enabledSites, connectedSite, canUseConnected } = useManagerSeedWorkspace();
  const { sites: allWordPressSites } = useWordPressSites();

  const site = useMemo(() => {
    if (enabledSites.length === 0) {
      return buildTempLocalAnalysisSite("");
    }
    return connectedSite ?? enabledSites[0];
  }, [enabledSites, connectedSite]);

  if (!canUseConnected || enabledSites.length === 0) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <p className={`text-base ${getCyberpunkTextClasses("muted")}`}>
            Add a WordPress property under Dashboard → Properties, then select it in the header. GBP Post
            uses the connected site for harness copy, media, and money-page links.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={SEO_WORKSPACE_SHELL_CLASS}>
      <GbpPostPropertyPanel
        site={site}
        allSites={allWordPressSites}
        onPlatformChange={onPlatformChange}
      />
    </div>
  );
};
