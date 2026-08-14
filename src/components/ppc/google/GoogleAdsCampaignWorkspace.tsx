import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { GoogleAdsCampaignsSection } from "@/components/ppc/google/GoogleAdsCampaignsSection";
import { GoogleAdsWorkspaceHeader } from "@/components/ppc/google/GoogleAdsWorkspaceHeader";
import {
  CONTENT_OPTIMIZER_BODY_INSET_CLASS,
  CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { usePpcGoogleWorkspace } from "@/hooks/ppc/use-ppc-google-workspace";
import type { WordPressSite } from "@/components/integrations/types";
import { cn } from "@/lib/utils";

export type GoogleAdsCampaignWorkspaceProps = {
  site: WordPressSite;
  apiKey: string;
  selectedModel: string;
  onPlatformChange: (tab: "ppc-google" | "ppc-meta") => void;
};

export function GoogleAdsCampaignWorkspace({
  site,
  apiKey,
  selectedModel,
  onPlatformChange,
}: GoogleAdsCampaignWorkspaceProps) {
  const ctrl = usePpcGoogleWorkspace({ site, apiKey, selectedModel });

  return (
    <div className={CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <GoogleAdsWorkspaceHeader ctrl={ctrl} onPlatformChange={onPlatformChange} />
      </div>
      <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, CONTENT_OPTIMIZER_BODY_INSET_CLASS, "flex flex-col")}>
        <GoogleAdsCampaignsSection ctrl={ctrl} />
      </div>
    </div>
  );
}
