import { useCallback, useEffect, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import {
  createBulkGscKeywordsHostedLink,
  revokeBulkGscKeywordsHostedLink,
  type BulkGscKeywordsHostedLink,
} from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import { revokeBulkSitemapInventoryLinks } from "@/lib/bulk/bulk-sitemap-inventory-session";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import {
  ensureEntitySiteWarmCache,
  getEntitySiteWarmCacheIfReady,
  gscAllQueriesFromWarmBundle,
  subscribeEntitySiteWarmInflight,
  getEntitySiteWarmInflightSnapshot,
} from "@/lib/local-analysis/entity-site-warm-cache";

export type OverviewSiteWarmDetailsState = {
  sitemapInventoryLinks: PromptBulkSitemapInventoryLink[];
  gscHostedLink: BulkGscKeywordsHostedLink | null;
  sitemapInventoryLoading: boolean;
};

export function useOverviewSiteWarmDetails(
  site: WordPressSite | null | undefined,
): OverviewSiteWarmDetailsState {
  useSyncExternalStore(subscribeEntitySiteWarmInflight, getEntitySiteWarmInflightSnapshot);

  const [sitemapInventoryLinks, setSitemapInventoryLinks] = useState<PromptBulkSitemapInventoryLink[]>(
    () => (site?.id ? getEntitySiteWarmCacheIfReady(site.id)?.inventory.links ?? [] : []),
  );
  const [gscHostedLink, setGscHostedLink] = useState<BulkGscKeywordsHostedLink | null>(null);
  const [sitemapInventoryLoading, setSitemapInventoryLoading] = useState(false);

  const sitemapLinksRef = useRef<PromptBulkSitemapInventoryLink[]>([]);
  const gscLinkRef = useRef<BulkGscKeywordsHostedLink | null>(null);

  const commitSitemapInventoryLinks = useCallback((links: PromptBulkSitemapInventoryLink[]) => {
    revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
    sitemapLinksRef.current = links;
    setSitemapInventoryLinks(links);
  }, []);

  const commitGscHostedLink = useCallback(
    (siteUrl: string, queries: ReturnType<typeof gscAllQueriesFromWarmBundle>) => {
      revokeBulkGscKeywordsHostedLink(gscLinkRef.current);
      if (!siteUrl || queries.length === 0) {
        gscLinkRef.current = null;
        setGscHostedLink(null);
        return;
      }
      const link = createBulkGscKeywordsHostedLink(siteUrl, queries);
      gscLinkRef.current = link;
      setGscHostedLink(link);
    },
    [],
  );

  const applyWarmBundle = useCallback(
    (siteUrl: string) => {
      if (!site?.id) return;
      const warm = getEntitySiteWarmCacheIfReady(site.id);
      if (!warm) return;
      if (warm.inventory.links.length > 0) {
        commitSitemapInventoryLinks(warm.inventory.links);
      }
      const allGsc = gscAllQueriesFromWarmBundle(warm);
      commitGscHostedLink(siteUrl, allGsc);
    },
    [site?.id, commitSitemapInventoryLinks, commitGscHostedLink],
  );

  useEffect(() => {
    revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
    sitemapLinksRef.current = [];
    setSitemapInventoryLinks([]);
    revokeBulkGscKeywordsHostedLink(gscLinkRef.current);
    gscLinkRef.current = null;
    setGscHostedLink(null);
  }, [site?.id]);

  useEffect(() => {
    if (!site?.siteUrl?.trim()) return;
    let cancelled = false;
    setSitemapInventoryLoading(true);
    void ensureEntitySiteWarmCache(site, { requireGsc: false })
      .then((warm) => {
        if (cancelled) return;
        const siteUrl = site.siteUrl?.trim() ?? "";
        if (warm.inventory.links.length > 0) {
          commitSitemapInventoryLinks(warm.inventory.links);
        }
        const allGsc = gscAllQueriesFromWarmBundle(warm);
        commitGscHostedLink(siteUrl, allGsc);
      })
      .finally(() => {
        if (!cancelled) setSitemapInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [site, commitSitemapInventoryLinks, commitGscHostedLink]);

  useEffect(() => {
    if (!site?.id) return;
    const siteUrl = site.siteUrl?.trim() ?? "";
    applyWarmBundle(siteUrl);
  }, [site?.id, site?.siteUrl, applyWarmBundle]);

  useEffect(() => {
    return () => {
      revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
      revokeBulkGscKeywordsHostedLink(gscLinkRef.current);
    };
  }, []);

  return {
    sitemapInventoryLinks,
    gscHostedLink,
    sitemapInventoryLoading,
  };
}
