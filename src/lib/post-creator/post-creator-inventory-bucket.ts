import type { WordPressSite } from "@/components/integrations/types";
import { ensureBulkGenerationWpInventory } from "@/lib/bulk/bulk-generation-wp-inventory";
import {
  loadBulkSitemapInventoryForSite,
  type LoadBulkSitemapInventoryResult,
} from "@/lib/bulk/bulk-sitemap-inventory-session";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

export type PostCreatorContentBucketFile = {
  bucket: OverviewSitemapSource;
  name: string;
  content: string;
  mimeType: string;
};

export type PostCreatorInventoryBucketLoadResult = {
  inventory: LoadBulkSitemapInventoryResult;
  bucketFiles: PostCreatorContentBucketFile[];
};

export function buildContentBucketFiles(
  inventory: LoadBulkSitemapInventoryResult,
  siteUrl: string,
): PostCreatorContentBucketFile[] {
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "-").slice(0, 40) || "site";
  const files: PostCreatorContentBucketFile[] = [];
  for (const source of inventory.sources) {
    const block = inventory.buckets[source];
    if (!block?.json?.trim()) continue;
    files.push({
      bucket: source,
      name: `content-bucket-${source}-${host}.json`,
      content: block.json,
      mimeType: "application/json",
    });
  }
  return files;
}

export async function loadPostCreatorInventoryBuckets(
  site: WordPressSite,
  onProgress?: (message: string) => void,
): Promise<PostCreatorInventoryBucketLoadResult> {
  onProgress?.("Loading content bucket…");
  await ensureBulkGenerationWpInventory(site, onProgress);
  const inventory = await loadBulkSitemapInventoryForSite(site, onProgress);
  const bucketFiles = buildContentBucketFiles(inventory, site.siteUrl);
  return { inventory, bucketFiles };
}

export function contentBucketFilesToHosted(
  runId: number,
  files: readonly PostCreatorContentBucketFile[],
): Array<{ id: string; name: string; href: string }> {
  const byRunId = contentBucketBlobUrls.get(runId) ?? new Map<string, string>();
  contentBucketBlobUrls.set(runId, byRunId);
  return files.map((file) => {
    const id = `content-bucket-${file.bucket}`;
    let href = byRunId.get(id);
    if (!href) {
      href = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
      byRunId.set(id, href);
    }
    return { id, name: file.name, href };
  });
}

const contentBucketBlobUrls = new Map<number, Map<string, string>>();

export function clearPostCreatorContentBucketBlobs(runId: number): void {
  const byRunId = contentBucketBlobUrls.get(runId);
  if (!byRunId) return;
  for (const href of byRunId.values()) {
    if (href.startsWith("blob:")) URL.revokeObjectURL(href);
  }
  contentBucketBlobUrls.delete(runId);
}
