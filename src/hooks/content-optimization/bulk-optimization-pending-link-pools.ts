import type { ExtraTextInventoryLinkRow } from "@/lib/content-generation/extra-text-inventory-links";

/** Sync link pools into every bulk prefetched pending row (post loop reads cache, not React pending). */
export function patchBulkPrefetchedPendingLinkPools(
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>,
  wordPressPostsForRun: unknown[],
  wordPressPagesForOfferTable?: ExtraTextInventoryLinkRow[],
): void {
  if (!prefetchedPendingCache.size) return;

  for (const [index, entry] of prefetchedPendingCache) {
    if (!entry?.pending || typeof entry.pending !== "object") continue;
    const pending = entry.pending as Record<string, unknown>;
    pending.wordPressPosts = wordPressPostsForRun;
    if (wordPressPagesForOfferTable?.length) {
      pending.wordPressPagesForOfferTable = wordPressPagesForOfferTable;
    }
    prefetchedPendingCache.set(index, entry);
  }
}
