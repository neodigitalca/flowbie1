import { ExternalLink } from "lucide-react";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { PromptBulkSiteKwHostedLink } from "@/lib/bulk/prompt-bulk-site-kw-scrape";

function InventoryHostedLinkRow({
  label,
  href,
  filename,
  count,
  unit,
}: {
  label: string;
  href: string;
  filename: string;
  count: number;
  unit: string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium text-white">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 hover:underline"
      >
        {filename}
      </a>
      <span className="text-muted-foreground">
        ({count} {unit})
      </span>
    </li>
  );
}

export function SitemapInventoryLinksList({
  links,
  gscLink,
}: {
  links: PromptBulkSitemapInventoryLink[];
  gscLink?: BulkGscKeywordsHostedLink | PromptBulkSiteKwHostedLink | null;
}) {
  if (!links.length && !gscLink) return null;
  return (
    <ul className="space-y-1 px-2.5 py-2 sm:px-3">
      {links.map((link) => (
        <InventoryHostedLinkRow
          key={link.href}
          label={link.label}
          href={link.href}
          filename={link.filename}
          count={link.rowCount}
          unit="URLs"
        />
      ))}
      {gscLink ? (
        <InventoryHostedLinkRow
          key={gscLink.href}
          label={gscLink.label}
          href={gscLink.href}
          filename={gscLink.filename}
          count={gscLink.rowCount}
          unit="keywords"
        />
      ) : null}
    </ul>
  );
}
