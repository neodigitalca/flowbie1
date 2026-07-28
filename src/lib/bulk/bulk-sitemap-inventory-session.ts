import type { WordPressSite } from "@/components/integrations/types";
import { parseCompactInventoryUrls } from "@/lib/bulk/inventory-json-slim";
import {
  fetchPromptBulkSitemapInventory,
  revokePromptBulkSitemapInventoryLinks,
  type PromptBulkSitemapInventoryLink,
  type PromptBulkSitemapInventoryResult,
} from "@/lib/bulk/prompt-bulk-sitemap-inventory";

export type BulkSitemapPostsMetadata = {
  id: number;
  slug: string;
  title: string;
  link: string;
};

export type LoadBulkSitemapInventoryResult = PromptBulkSitemapInventoryResult & {
  postsMetadata: BulkSitemapPostsMetadata[];
};

export function revokeBulkSitemapInventoryLinks(
  links: PromptBulkSitemapInventoryLink[] | null | undefined,
): void {
  revokePromptBulkSitemapInventoryLinks(links);
}

/** Yield one frame so Details can paint sitemap links before long async work continues. */
export function yieldFrameForDetailsPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function postsMetadataFromInventory(inventory: PromptBulkSitemapInventoryResult): BulkSitemapPostsMetadata[] {
  const mergedRows = inventory.sources.flatMap((source) => {
    try {
      return parseCompactInventoryUrls(inventory.buckets[source].json);
    } catch {
      return [];
    }
  });
  return mergedRows.map((link) => ({
    id: 0,
    slug: "",
    title: "",
    link,
  }));
}

/** Shared Prompt + Entity sitemap load (Pages, Posts, SAP buckets + blob links). */
export async function loadBulkSitemapInventoryForSite(
  site: WordPressSite,
  onProgress?: (message: string) => void,
): Promise<LoadBulkSitemapInventoryResult> {
  if (!site.siteUrl?.trim() || !site.username?.trim() || !site.appPassword?.trim()) {
    throw new Error(
      "WordPress username and application password are required to load sitemap inventory.",
    );
  }
  onProgress?.("Loading Posts, Pages, and SAP sitemap inventory");
  const inventory = await fetchPromptBulkSitemapInventory(site, onProgress);
  return { ...inventory, postsMetadata: postsMetadataFromInventory(inventory) };
}
