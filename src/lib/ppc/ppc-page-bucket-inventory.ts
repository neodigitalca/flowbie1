import type { WordPressSite } from "@/components/integrations/types";
import { decodeInventoryTitleText, inventoryUrlForRow } from "@/lib/bulk/inventory-json-slim";
import { fetchOverviewInventoryForSource } from "@/lib/overview/overview-parallel-inventory-fetch";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type PpcPageBucketHostedLink = {
  label: string;
  href: string;
  filename: string;
  rowCount: number;
};

function hostSlugForInventoryFile(siteUrl: string): string {
  try {
    const raw = siteUrl.trim();
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname.replace(/[^a-zA-Z0-9.-]+/g, "-").slice(0, 80) || "site";
  } catch {
    return "site";
  }
}

export function mapOverviewRowToPpcWpPageContext(row: {
  url?: string;
  slug?: string;
  fields?: { title?: string; excerpt?: string; meta?: string; keyword?: string };
}): PpcWpPageContext | null {
  const url = inventoryUrlForRow(row);
  if (!url) return null;
  return {
    url,
    title: decodeInventoryTitleText(row.fields?.title?.trim() || row.slug || url),
    excerpt: row.fields?.excerpt?.trim() || "",
    metaDescription: row.fields?.meta?.trim() || "",
    keyword: row.fields?.keyword?.trim() || "",
  };
}

export async function loadPpcPageBucketContext(site: WordPressSite): Promise<PpcWpPageContext[]> {
  if (!site.username?.trim() || !site.appPassword?.trim()) {
    throw new Error("WordPress credentials are required to load page bucket inventory.");
  }

  const { rows, errors } = await fetchOverviewInventoryForSource(site, "pages", {
    includeScheduled: true,
  });

  const pages = rows
    .map(mapOverviewRowToPpcWpPageContext)
    .filter((page): page is PpcWpPageContext => Boolean(page));

  if (!pages.length) {
    const errText = Object.values(errors).filter(Boolean).join(" · ");
    throw new Error(errText || "Page bucket inventory returned no URLs.");
  }

  return pages;
}

export function stringifyPpcPageBucketUrlTitleJson(pages: PpcWpPageContext[]): string {
  return JSON.stringify(
    pages.map((page) => ({
      url: page.url,
      title: page.title,
    })),
    null,
    2,
  );
}

export function createPpcPageBucketHostedLink(
  siteUrl: string,
  pages: PpcWpPageContext[],
): PpcPageBucketHostedLink {
  const slug = hostSlugForInventoryFile(siteUrl);
  const filename = `ppc-page-bucket-${slug}-${Date.now()}.json`;
  const json = stringifyPpcPageBucketUrlTitleJson(pages);
  const href = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
  return {
    label: "Page bucket",
    href,
    filename,
    rowCount: pages.length,
  };
}

export function revokePpcPageBucketHostedLink(href: string | null | undefined): void {
  if (href?.startsWith("blob:")) {
    URL.revokeObjectURL(href);
  }
}

export function resolvePpcAllowedLandingPages(
  pages: PpcWpPageContext[],
  selectedUrls: string[],
): PpcWpPageContext[] {
  if (!pages.length) {
    throw new Error("Page bucket inventory is empty.");
  }

  if (selectedUrls.length === 0) {
    return pages;
  }

  const byUrlKey = new Map(pages.map((page) => [normalizePageUrlKey(page.url), page]));
  const selected = selectedUrls
    .map((url) => byUrlKey.get(normalizePageUrlKey(url)))
    .filter((page): page is PpcWpPageContext => Boolean(page));

  if (!selected.length) {
    throw new Error("Selected landing pages were not found in the page bucket inventory.");
  }

  return selected;
}
