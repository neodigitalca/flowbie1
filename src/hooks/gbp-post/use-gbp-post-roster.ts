import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import { filterSitesWithGbpLocation } from "@/lib/gbp-post/gbp-site-eligibility";

export function useGbpPostRoster(allSites: WordPressSite[]) {
  const { activeWordPressSiteId } = useWordPressOptimization();
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(() => new Set());
  const [topicBySiteId, setTopicBySiteId] = useState<Record<string, string>>({});

  const sitesKey = useMemo(
    () =>
      allSites
        .map((s) => `${s.id}:${s.gbpLocationId ?? ""}`)
        .sort()
        .join("|"),
    [allSites],
  );

  const rosterSites = useMemo(() => filterSitesWithGbpLocation(allSites), [allSites]);
  const lastSitesKeyRef = useRef("");

  useEffect(() => {
    if (!rosterSites.length) {
      setSelectedSiteIds(
        activeWordPressSiteId ? new Set([activeWordPressSiteId]) : new Set(),
      );
      lastSitesKeyRef.current = sitesKey;
      return;
    }
    if (lastSitesKeyRef.current !== sitesKey) {
      setSelectedSiteIds(new Set(rosterSites.map((s) => s.id)));
      lastSitesKeyRef.current = sitesKey;
    }
  }, [sitesKey, rosterSites, activeWordPressSiteId]);

  const selectedSiteIdList = useMemo(() => [...selectedSiteIds], [selectedSiteIds]);

  const selectedSites = useMemo(
    () => rosterSites.filter((s) => selectedSiteIds.has(s.id)),
    [rosterSites, selectedSiteIds],
  );

  const loadAllClients = useCallback(() => {
    setSelectedSiteIds(new Set(rosterSites.map((s) => s.id)));
  }, [rosterSites]);

  const selectNoClients = useCallback(() => {
    setSelectedSiteIds(new Set());
  }, []);

  const toggleSiteSelected = useCallback((siteId: string, checked: boolean) => {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(siteId);
      else next.delete(siteId);
      return next;
    });
  }, []);

  const setTopicForSite = useCallback((siteId: string, topic: string) => {
    setTopicBySiteId((prev) => ({ ...prev, [siteId]: topic }));
  }, []);

  const topicForSite = useCallback(
    (siteId: string) => topicBySiteId[siteId] ?? "",
    [topicBySiteId],
  );

  return {
    rosterSites,
    selectedSiteIds,
    selectedSiteIdList,
    selectedSites,
    topicBySiteId,
    setTopicForSite,
    topicForSite,
    loadAllClients,
    selectNoClients,
    toggleSiteSelected,
  };
}
