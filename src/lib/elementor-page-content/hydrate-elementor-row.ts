import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { fetchElementorPage, siteReadyForElementorApi } from "@/lib/elementor-api";
import { runDesignBreakdownAgent } from "@/lib/elementor-optimizer";
import { detectHarnessSlotsFromElementor } from "@/lib/elementor-page-content/detect-harness-slots";
import { parseElementorSectionOutline } from "@/lib/elementor-page-content/parse-elementor-section-outline";

export type HydrateElementorRowResult = {
  patch: Partial<OverviewRow>;
  postId: number;
};

export async function hydrateElementorRow(
  site: WordPressSite,
  url: string,
  options?: {
    siteId?: string;
    skipBreakdown?: boolean;
    signal?: AbortSignal;
    /** Prefer Novamira page id over slug lookup when known from inventory/bindings. */
    postId?: number | null;
  },
): Promise<HydrateElementorRowResult> {
  if (!siteReadyForElementorApi(site)) {
    throw new Error("WordPress site credentials are not configured.");
  }

  const pageKey =
    options?.postId != null && Number.isFinite(options.postId) && options.postId > 0
      ? String(options.postId)
      : url;
  const page = await fetchElementorPage(site, pageKey);
  const raw =
    typeof page.rawElementorData === "string"
      ? page.rawElementorData
      : JSON.stringify(page.elementorData);

  const breakdown = options?.skipBreakdown
    ? undefined
    : await runDesignBreakdownAgent(raw, {
        siteId: options?.siteId ?? site.id,
        signal: options?.signal,
      });

  const sectionHeaders = parseElementorSectionOutline(page.elementorData);
  const harnessSlots = detectHarnessSlotsFromElementor(page.elementorData);

  return {
    postId: page.postId,
    patch: {
      contentFormat: "elementor",
      postId: page.postId,
      postType: "page",
      elementorDataJson: raw,
      elementorDesignBreakdown: breakdown,
      elementorSectionHeaders: sectionHeaders,
      elementorHarnessSlots: harnessSlots,
      blogH2List: sectionHeaders.map((s) => s.title),
    },
  };
}
