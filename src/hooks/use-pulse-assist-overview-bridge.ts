import { useEffect } from "react";
import { usePulseAssistContext } from "@/contexts/pulse-assist-context";
import type { PulseAssistOverviewBridge } from "@/contexts/pulse-assist-context";

export type UsePulseAssistOverviewBridgeArgs = {
  sitemapSource: string;
  expandedPageUrl: string | null;
  expandedPageTitle?: string | null;
};

export function buildOverviewBridgeSyncPatch(
  args: UsePulseAssistOverviewBridgeArgs,
): Pick<PulseAssistOverviewBridge, "sitemapSource" | "expandedPageUrl" | "expandedPageTitle" | "postId"> {
  return {
    sitemapSource: args.sitemapSource,
    expandedPageUrl: args.expandedPageUrl,
    expandedPageTitle: args.expandedPageTitle ?? null,
    postId: 0,
  };
}

export function usePulseAssistOverviewBridge({
  sitemapSource,
  expandedPageUrl,
  expandedPageTitle,
}: UsePulseAssistOverviewBridgeArgs): void {
  const { setOverviewBridge } = usePulseAssistContext();

  useEffect(() => {
    setOverviewBridge(
      buildOverviewBridgeSyncPatch({ sitemapSource, expandedPageUrl, expandedPageTitle }),
    );
  }, [sitemapSource, expandedPageUrl, expandedPageTitle, setOverviewBridge]);
}
