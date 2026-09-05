export const AGENT_RUNS_ALL_SITES_ID = "__all_sites__";

export function resolveDefaultAgentsSiteFilter(
  activeWordPressSiteId: string | null,
  enabledSiteIds: string[],
): string {
  if (activeWordPressSiteId && enabledSiteIds.includes(activeWordPressSiteId)) {
    return activeWordPressSiteId;
  }
  return enabledSiteIds[0] ?? AGENT_RUNS_ALL_SITES_ID;
}

export function isAgentsAllSitesFilter(siteFilter: string): boolean {
  return siteFilter === AGENT_RUNS_ALL_SITES_ID;
}
