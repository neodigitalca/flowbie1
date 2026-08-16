import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { PromptBulkSiteKwHostedLink } from "@/lib/bulk/prompt-bulk-site-kw-scrape";
import { SitemapInventoryLinksList } from "@/components/keyword-research/bulk/SitemapInventoryLinksList";

const INVENTORY_BUCKET_LABELS = ["Pages", "Posts", "SAP"] as const;

export type BulkSitemapInventoryRunDetailProps = {
  links: PromptBulkSitemapInventoryLink[];
  gscHostedLink?: BulkGscKeywordsHostedLink | PromptBulkSiteKwHostedLink | null;
  loading?: boolean;
};

/** Shared Run detail block: sitemap + GSC hosted JSON links. */
export function BulkSitemapInventoryRunDetail({
  links,
  gscHostedLink = null,
  loading = false,
}: BulkSitemapInventoryRunDetailProps) {
  const hasLinks = links.length > 0 || Boolean(gscHostedLink);
  if (!loading && !hasLinks) return null;

  if (hasLinks) {
    return (
      <>
        <p className="px-2.5 py-1 text-base font-medium text-white sm:px-3">Sitemap inventory</p>
        <SitemapInventoryLinksList links={links} gscLink={gscHostedLink} />
      </>
    );
  }

  return (
    <>
      <p className="px-2.5 py-1 text-base font-medium text-white sm:px-3">Sitemap inventory</p>
      <ul className="space-y-1 px-2.5 py-2 sm:px-3">
        {INVENTORY_BUCKET_LABELS.map((label) => (
          <li key={label} className="text-base text-muted-foreground">
            {label} (loading…)
          </li>
        ))}
        <li className="text-base text-muted-foreground">GSC (loading…)</li>
      </ul>
    </>
  );
}
