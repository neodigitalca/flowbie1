import type { WordPressSite } from "@/components/integrations/types";
import { extractEndpointFromEntitySitemapUrl } from "@/lib/entity-endpoint-extractor";
import { sitemapOptimizerEntityCollectionLabel } from "@/lib/sitemap-optimizer/sitemap-optimizer-toolbar-copy";
import type { SitemapOptimizerCollectionKey } from "@/lib/sitemap-optimizer/types";

export type SitemapOptimizerCollectionOption = {
  key: SitemapOptimizerCollectionKey;
  label: string;
  restCollection: string;
  enabled: boolean;
};

export function buildSitemapOptimizerCollectionOptions(
  site: WordPressSite | null | undefined,
): SitemapOptimizerCollectionOption[] {
  const entityUrl = site?.entitySitemapUrl?.trim() ?? "";
  const entityEndpoint = entityUrl ? extractEndpointFromEntitySitemapUrl(entityUrl) : "";
  const hasEntity =
    Boolean(entityUrl) &&
    entityEndpoint.length > 0 &&
    entityEndpoint !== "posts" &&
    entityEndpoint !== "pages" &&
    entityEndpoint !== "post" &&
    entityEndpoint !== "page";

  return [
    { key: "posts", label: "Posts", restCollection: "posts", enabled: true },
    { key: "pages", label: "Pages", restCollection: "pages", enabled: true },
    {
      key: "entity",
      label: hasEntity ? sitemapOptimizerEntityCollectionLabel(entityEndpoint) : "SAP",
      restCollection: hasEntity ? entityEndpoint : "",
      enabled: hasEntity,
    },
  ];
}

export function restCollectionsFromSelectedKeys(
  options: SitemapOptimizerCollectionOption[],
  selected: Set<SitemapOptimizerCollectionKey>,
): string[] {
  const out: string[] = [];
  for (const opt of options) {
    if (!selected.has(opt.key) || !opt.enabled || !opt.restCollection.trim()) continue;
    if (!out.includes(opt.restCollection)) out.push(opt.restCollection);
  }
  return out;
}
