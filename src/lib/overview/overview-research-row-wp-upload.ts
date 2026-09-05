import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import {
  resolveOverviewBindingForRow,
  uploadOverviewRowSeoToWordPress,
} from "@/lib/overview/overview-bulk-seo-payload";

export type OverviewResearchRowWpUploadResult = {
  ok: boolean;
  skipped: boolean;
  error?: string;
  postId?: number;
};

export type OverviewResearchRowWpUploadParams = {
  site: WordPressSite;
  row: OverviewRow;
  bindings: Record<string, OverviewBinding | undefined>;
  getInventoryMatchForUrl: (
    site: WordPressSite,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
};

/** Upload one researched grid row to WordPress. Skip when there is no brief or no post id. */
export async function uploadOverviewResearchedRowToWordPress(
  params: OverviewResearchRowWpUploadParams,
): Promise<OverviewResearchRowWpUploadResult> {
  const seoResearch = params.row.seoResearch?.trim() ?? "";
  if (!seoResearch) {
    return { ok: false, skipped: true };
  }

  const url = params.row.url?.trim() ?? "";
  const invMatch = url ? params.getInventoryMatchForUrl(params.site, url) : undefined;
  const invHit =
    invMatch?.row?.id != null && Number.isFinite(invMatch.row.id)
      ? {
          row: { id: invMatch.row.id, date_gmt: invMatch.row.date_gmt ?? null },
          subtype: invMatch.subtype,
        }
      : undefined;
  const binding = resolveOverviewBindingForRow(params.row, params.bindings, invHit);
  if (!binding?.postId) {
    return { ok: false, skipped: true };
  }

  try {
    const result = await uploadOverviewRowSeoToWordPress(params.site, params.row, binding);
    if (!result.ok) {
      return {
        ok: false,
        skipped: false,
        error: result.error || "WordPress rejected the update.",
        postId: binding.postId,
      };
    }
    return { ok: true, skipped: false, postId: binding.postId };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : "WordPress update failed.",
      postId: binding.postId,
    };
  }
}
