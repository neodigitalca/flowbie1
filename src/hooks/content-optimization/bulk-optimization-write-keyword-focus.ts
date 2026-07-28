import type { WordPressSite } from "@/components/integrations/types";
import { updateWordPressAcfFields } from "@/lib/wordpress-api";
import { WORDPRESS_BULK_READ_CHUNK } from "@/lib/wordpress-api/bulk-read-chunk";

function postIdFromPending(pending: Record<string, any>): number | null {
  const id = pending?.existingPost?.id ?? pending?.resolved?.id;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function postSubtypeFromPending(pending: Record<string, any>): string {
  const sub =
    pending?.existingPost?.postTypeSubtype ??
    pending?.resolved?.subtype ??
    "post";
  return typeof sub === "string" && sub.trim() ? sub.trim() : "post";
}

function postEndpointFromPending(pending: Record<string, any>): string | undefined {
  const ep = pending?.existingPost?.postTypeEndpoint ?? pending?.resolved?.endpoint;
  return typeof ep === "string" && ep.trim() ? ep.trim() : undefined;
}

/**
 * Writes newly researched `keyword_focus` values back to WordPress ACF (non-fatal on failure).
 */
export async function writeBulkResearchedKeywordFocusToWordPress(opts: {
  site: WordPressSite;
  researchedIndices: number[];
  prefetchedPendingCache: Map<
    number,
    { pending: Record<string, unknown>; primaryKeyword: string }
  >;
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>;
  muteToasts?: boolean;
}): Promise<void> {
  const { site, researchedIndices, prefetchedPendingCache, prefetchedAcfFieldsCache, muteToasts } =
    opts;

  if (!site.username || !site.appPassword || researchedIndices.length === 0) return;

  const unique = [...new Set(researchedIndices)].filter((i) => i >= 0);

  for (let c = 0; c < unique.length; c += WORDPRESS_BULK_READ_CHUNK) {
    const slice = unique.slice(c, c + WORDPRESS_BULK_READ_CHUNK);
    await Promise.all(
      slice.map(async (i) => {
        const kw = String(prefetchedAcfFieldsCache.get(i)?.["keyword_focus"] ?? "").trim();
        if (!kw) return;

        const pend = prefetchedPendingCache.get(i);
        if (!pend?.pending || typeof pend.pending !== "object") return;

        const pending = pend.pending as Record<string, any>;
        const postId = postIdFromPending(pending);
        if (!postId) return;

        const res = await updateWordPressAcfFields(
          site.siteUrl,
          site.username!,
          site.appPassword!,
          postId,
          postSubtypeFromPending(pending),
          postEndpointFromPending(pending),
          { keyword_focus: kw },
        );

        if (!res.success) {
          console.warn(
            `[Bulk Optimization] keyword_focus write-back failed (index ${i}, post ${postId}):`,
            res.error,
          );
          if (!muteToasts) {
            const url = typeof pending.url === "string" ? pending.url : "";
            console.warn(`[Bulk Optimization] Could not save keyword_focus for ${url || postId}`);
          }
        }
      }),
    );
  }
}
