import type { WordPressSite } from "@/components/integrations/types";

export function readSiteBenchmarkCustomTag(site: WordPressSite): string {
  return (site.benchmarkCustomTag ?? "").trim();
}

export function applyCustomTagsFromSites(sites: WordPressSite[]): {
  tagBySiteId: Record<string, string>;
  labelBySiteId: Record<string, string>;
} {
  const tagBySiteId: Record<string, string> = {};
  const labelBySiteId: Record<string, string> = {};
  for (const site of sites) {
    const label = readSiteBenchmarkCustomTag(site);
    if (!label) continue;
    tagBySiteId[site.id] = `custom_${label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")}`;
    labelBySiteId[site.id] = label;
  }
  return { tagBySiteId, labelBySiteId };
}
