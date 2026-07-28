import type { OverviewBulkSeoApiItem } from "@/lib/overview/overview-bulk-seo-payload";
import { restCollectionEndpointForSubtype } from "@/lib/overview/overview-bulk-seo-payload";
import { extraTextToUploadHtml } from "@/lib/content-generation/extra-text-heading-contract";

export function buildBulkExtraTextItem(opts: {
  postId: number;
  postType: string;
  postTypeEndpoint?: string;
  extraTextRaw: string;
}): OverviewBulkSeoApiItem | null {
  const postId = Number(opts.postId);
  if (!Number.isFinite(postId) || postId <= 0) return null;

  const raw = (opts.extraTextRaw ?? "").trim();
  if (!raw) return null;

  const html = extraTextToUploadHtml(raw);
  if (!html.trim()) return null;

  const subtype = (opts.postType || "post").trim() || "post";
  const postTypeEndpoint = opts.postTypeEndpoint?.trim() || restCollectionEndpointForSubtype(subtype);

  return {
    postId,
    postType: subtype,
    postTypeEndpoint,
    acf: {
      extra_text: html,
      seo_extra_text: html,
    },
  };
}
