import { useCallback, useEffect, useMemo } from "react";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import {
  buildAgentRunGroups,
  buildAgentRunSiteNameMap,
  mergeEnabledSiteClientGroups,
  type AgentRunClientGroup,
} from "@/lib/agent-runs/agent-run-grouping";
import { resolveDefaultAgentsSiteFilter } from "@/lib/agent-runs/agent-runs-site-filter";

export function useAgentRunsSiteFilterModel() {
  const { runs, agentsSiteFilter, setAgentsSiteFilter, sidebarOpen, sidebarPanel } =
    useAgentRunsContext();
  const { activeWordPressSiteId, setActiveWordPressSiteId } = useActiveWordPressSite();
  const { sites: wpSites, handleConnectSite } = useWordPressSites();

  const allSiteIds = useMemo(() => wpSites.map((site) => site.id), [wpSites]);
  const siteNameById = useMemo(() => buildAgentRunSiteNameMap(wpSites), [wpSites]);

  const runGroups = useMemo(
    () => buildAgentRunGroups(runs, siteNameById),
    [runs, siteNameById],
  );

  const allSiteGroups = useMemo(
    () => mergeEnabledSiteClientGroups(allSiteIds, runGroups, siteNameById),
    [allSiteIds, runGroups, siteNameById],
  );

  const activeCountBySiteId = useMemo(() => {
    const map = new Map<string, number>();
    for (const client of allSiteGroups) {
      map.set(client.siteId, client.activeCount);
    }
    return map;
  }, [allSiteGroups]);

  const siteFilterOptions = useMemo(
    () =>
      wpSites.map((site) => ({
        id: site.id,
        label: site.name?.trim() || site.siteUrl || site.id,
        activeCount: activeCountBySiteId.get(site.id) ?? 0,
      })),
    [activeCountBySiteId, wpSites],
  );

  const resolvedSiteFilter = useMemo(
    () =>
      allSiteIds.includes(agentsSiteFilter)
        ? agentsSiteFilter
        : resolveDefaultAgentsSiteFilter(activeWordPressSiteId, allSiteIds),
    [activeWordPressSiteId, agentsSiteFilter, allSiteIds],
  );

  const selectedClient: AgentRunClientGroup | undefined = useMemo(
    () => allSiteGroups.find((group) => group.siteId === resolvedSiteFilter) ?? allSiteGroups[0],
    [allSiteGroups, resolvedSiteFilter],
  );

  useEffect(() => {
    if (!sidebarOpen || sidebarPanel !== "agents") return;
    if (allSiteIds.includes(agentsSiteFilter)) return;
    setAgentsSiteFilter(resolveDefaultAgentsSiteFilter(activeWordPressSiteId, allSiteIds));
  }, [
    activeWordPressSiteId,
    agentsSiteFilter,
    allSiteIds,
    setAgentsSiteFilter,
    sidebarOpen,
    sidebarPanel,
  ]);

  const selectSite = useCallback(
    (siteId: string) => {
      setAgentsSiteFilter(siteId);
      setActiveWordPressSiteId(siteId);
      const site = wpSites.find((s) => s.id === siteId);
      if (site) void handleConnectSite(site);
    },
    [handleConnectSite, setActiveWordPressSiteId, setAgentsSiteFilter, wpSites],
  );

  return {
    allSiteIds,
    allSiteGroups,
    resolvedSiteFilter,
    selectedClient,
    setAgentsSiteFilter: selectSite,
    siteFilterOptions,
  };
}
