import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import {
  resolveOverviewBindingForRow,
  uploadOverviewRowSeoToWordPress,
} from "@/lib/overview/overview-bulk-seo-payload";
import {
  buildOverviewRowWpUploadProofFiles,
  type OverviewWpUploadProofFile,
} from "@/lib/overview/overview-wp-upload-harness-artifacts";

export type OverviewResearchRowWpUploadResult = {
  ok: boolean;
  skipped: boolean;
  error?: string;
  postId?: number;
  generatedFiles: OverviewWpUploadProofFile[];
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
  const uploadedAt = new Date().toISOString();
  const url = params.row.url?.trim() ?? "";
  const invMatch = url ? params.getInventoryMatchForUrl(params.site, url) : undefined;
  const inventoryContent = invMatch?.row?.fields?.content?.trim() ?? "";
  const invHit =
    invMatch?.row?.id != null && Number.isFinite(invMatch.row.id)
      ? {
          row: { id: invMatch.row.id, date_gmt: invMatch.row.date_gmt ?? null },
          subtype: invMatch.subtype,
        }
      : undefined;
  const binding = resolveOverviewBindingForRow(params.row, params.bindings, invHit);

  const proof = (opts: {
    ok: boolean;
    skipped: boolean;
    error?: string;
    link?: string;
    apiResult?: { ok: boolean; error?: string; link?: string };
  }): OverviewWpUploadProofFile[] =>
    buildOverviewRowWpUploadProofFiles({
      site: params.site,
      row: params.row,
      binding,
      inventoryContent,
      uploadedAt,
      ...opts,
    });

  const seoResearch = params.row.seoResearch?.trim() ?? "";
  if (!seoResearch) {
    const error = "No research brief for this row.";
    return { ok: false, skipped: true, error, generatedFiles: proof({ ok: false, skipped: true, error }) };
  }

  if (!binding?.postId) {
    const error = "No WordPress post binding for this row.";
    return { ok: false, skipped: true, error, generatedFiles: proof({ ok: false, skipped: true, error }) };
  }

  try {
    const result = await uploadOverviewRowSeoToWordPress(params.site, params.row, binding, {
      inventoryContent,
    });
    if (!result.ok) {
      const error = result.error || "WordPress rejected the update.";
      return {
        ok: false,
        skipped: false,
        error,
        postId: binding.postId,
        generatedFiles: proof({
          ok: false,
          skipped: false,
          error,
          link: result.link,
          apiResult: result,
        }),
      };
    }
    return {
      ok: true,
      skipped: false,
      postId: binding.postId,
      generatedFiles: proof({
        ok: true,
        skipped: false,
        link: result.link,
        apiResult: result,
      }),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "WordPress update failed.";
    return {
      ok: false,
      skipped: false,
      error,
      postId: binding.postId,
      generatedFiles: proof({ ok: false, skipped: false, error }),
    };
  }
}
