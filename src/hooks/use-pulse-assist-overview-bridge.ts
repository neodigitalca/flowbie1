import { useEffect } from "react";
import { usePulseAssistContext } from "@/contexts/pulse-assist-context";
import { resolveNeoPulseUrl } from "@/lib/wordpress-api/neo-pulse-wp-tools";
import type { WordPressSite } from "@/components/integrations/types";

type UsePulseAssistOverviewBridgeArgs = {
  site: WordPressSite;
  sitemapSource: string;
  expandedPageUrl: string | null;
  expandedPageTitle?: string | null;
};

export function usePulseAssistOverviewBridge({
  site,
  sitemapSource,
  expandedPageUrl,
  expandedPageTitle,
}: UsePulseAssistOverviewBridgeArgs): void {
  const { setOverviewBridge } = usePulseAssistContext();

  useEffect(() => {
    setOverviewBridge({
      sitemapSource,
      expandedPageUrl,
      expandedPageTitle: expandedPageTitle ?? null,
      postId: 0,
    });

    if (!expandedPageUrl) return;

    let cancelled = false;
    void resolveNeoPulseUrl(site, expandedPageUrl).then((resolved) => {
      if (cancelled) return;
      setOverviewBridge({
        postId: resolved?.postId ?? 0,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [site, sitemapSource, expandedPageUrl, expandedPageTitle, setOverviewBridge]);
}
