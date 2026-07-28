import type { WordPressSite } from "@/components/integrations/types";

/**
 * Public / live site URL for display, reports, and SEO tools.
 * Falls back to `siteUrl` (WordPress REST base, often staging) when unset.
 */
export function getPublicSiteUrl(site: Pick<WordPressSite, "siteUrl" | "productionSiteUrl">): string {
  const pub = site.productionSiteUrl?.trim();
  if (pub) return pub;
  return (site.siteUrl || "").trim();
}
