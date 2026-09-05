import { Download } from "lucide-react";
import type { PromptBulkSitemapInventoryLink } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { BulkGscKeywordsHostedLink } from "@/lib/bulk/bulk-gsc-keywords-hosted-link";
import type { PromptBulkSiteKwHostedLink } from "@/lib/bulk/prompt-bulk-site-kw-scrape";

export const HOSTED_INVENTORY_DOWNLOAD_STAGGER_MS = 300;

export type HostedInventoryDownload = { href: string; filename: string };

export function hostedInventoryDownloads(
  links: PromptBulkSitemapInventoryLink[],
  gscLink?: BulkGscKeywordsHostedLink | PromptBulkSiteKwHostedLink | null,
): HostedInventoryDownload[] {
  const out: HostedInventoryDownload[] = links.map((link) => ({
    href: link.href,
    filename: link.filename,
  }));
  if (gscLink) out.push({ href: gscLink.href, filename: gscLink.filename });
  return out;
}

export function downloadHostedInventoryFile(file: HostedInventoryDownload): void {
  const a = document.createElement("a");
  a.href = file.href;
  a.download = file.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function downloadAllHostedInventoryFiles(
  links: PromptBulkSitemapInventoryLink[],
  gscLink?: BulkGscKeywordsHostedLink | PromptBulkSiteKwHostedLink | null,
): void {
  hostedInventoryDownloads(links, gscLink).forEach((file, index) => {
    setTimeout(() => downloadHostedInventoryFile(file), index * HOSTED_INVENTORY_DOWNLOAD_STAGGER_MS);
  });
}

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
    <li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-base">
      <Download className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-medium text-white">{label}</span>
      <span
        className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere] text-white"
        title={filename}
      >
        {filename}
      </span>
      <span className="text-muted-foreground">
        ({count} {unit})
      </span>
      <a
        href={href}
        download={filename}
        className="inline-flex h-7 shrink-0 items-center px-2 text-base text-white hover:bg-white/10 hover:text-white"
      >
        <Download className="mr-1 h-3 w-3" aria-hidden />
        File
      </a>
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
