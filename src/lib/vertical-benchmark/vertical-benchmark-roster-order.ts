import type { WordPressSite } from "@/components/integrations/types";

/** Connected site (manager header) processes first so inventory crawl matches the active property. */
export function orderBenchmarkSitesConnectedFirst(
  sites: WordPressSite[],
  connectedSiteId?: string | null,
): WordPressSite[] {
  if (!connectedSiteId || sites.length <= 1) return sites;
  const idx = sites.findIndex((s) => s.id === connectedSiteId);
  if (idx <= 0) return sites;
  const ordered = [...sites];
  const [connected] = ordered.splice(idx, 1);
  return connected ? [connected, ...ordered] : sites;
}

/** Inventory crawl always starts with the header connected site, even when it is outside the roster filter. */
export function buildBenchmarkInventorySiteQueue(
  curateSites: WordPressSite[],
  connectedSite?: WordPressSite | null,
): WordPressSite[] {
  if (!connectedSite) return curateSites;
  const rest = curateSites.filter((s) => s.id !== connectedSite.id);
  return [connectedSite, ...rest];
}

export function resolveBenchmarkCurateSites(args: {
  allSites: WordPressSite[];
  rosterSites: WordPressSite[];
  selectedSiteIds: Set<string>;
  connectedSiteId?: string | null;
}): { curateSites: WordPressSite[]; connectedSite: WordPressSite | null } {
  const connectedSite =
    args.connectedSiteId ?
      args.allSites.find((s) => s.id === args.connectedSiteId) ?? null
    : null;

  const curateSites: WordPressSite[] = [];
  for (const id of args.selectedSiteIds) {
    const site = args.allSites.find((s) => s.id === id) ?? args.rosterSites.find((s) => s.id === id);
    if (site && !curateSites.some((s) => s.id === site.id)) {
      curateSites.push(site);
    }
  }

  if (!curateSites.length && connectedSite) {
    return { curateSites: [connectedSite], connectedSite };
  }

  return {
    curateSites: orderBenchmarkSitesConnectedFirst(curateSites, connectedSite?.id),
    connectedSite,
  };
}

export function benchmarkSiteInventoryStepLabel(
  site: WordPressSite,
  connectedSiteId?: string | null,
): string {
  if (connectedSiteId && site.id === connectedSiteId) {
    return `Site inventory (connected): ${site.name}`;
  }
  return `Site inventory: ${site.name}`;
}
