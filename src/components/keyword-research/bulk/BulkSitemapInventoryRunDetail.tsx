import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { PromptBulkSiteKwHostedLink } from "@/lib/bulk/prompt-bulk-site-kw-scrape";
import { SitemapInventoryLinksList } from "@/components/keyword-research/bulk/SitemapInventoryLinksList";

export type BulkSitemapInventoryRunDetailProps = {
  links: PromptBulkSitemapInventoryLink[];
  gscHostedLink?: BulkGscKeywordsHostedLink | PromptBulkSiteKwHostedLink | null;
};

/** Shared Run detail block: sitemap + GSC hosted JSON links. */
export function BulkSitemapInventoryRunDetail({
  links,
  gscHostedLink = null,
}: BulkSitemapInventoryRunDetailProps) {
  if (links.length === 0 && !gscHostedLink) return null;
  return (
    <>
      <p className="px-2.5 py-1 text-base font-medium text-white sm:px-3">Sitemap inventory</p>
      <SitemapInventoryLinksList links={links} gscLink={gscHostedLink} />
    </>
  );
}
