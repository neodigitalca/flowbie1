import type { WordPressSite } from "@/components/integrations/types";
import type { SeoContentBriefV1 } from "@/lib/overview-seo-content-brief";
import { fetchSeoContentBriefWave } from "@/lib/llm-audit/fetch-seo-content-brief-wave";

export type FetchMergedSeoContentBriefInput = {
  keyword: string;
  pageUrl: string;
  site?: WordPressSite | null;
  location?: string;
  gscQueries?: string[];
  semrushOverviewJson?: unknown | null;
};

/** DataForSEO SERP dump + parallel LLM audit → merged `SeoContentBriefV1`. */
export async function fetchMergedSeoContentBriefLive(
  input: FetchMergedSeoContentBriefInput,
): Promise<SeoContentBriefV1> {
  const { brief } = await fetchSeoContentBriefWave({
    keyword: input.keyword,
    pageUrl: input.pageUrl,
    site: input.site,
    location: input.location,
    gscQueries: input.gscQueries,
    gscPageUrl: input.pageUrl,
    semrushOverviewJson: input.semrushOverviewJson,
  });
  return brief;
}

/** Merge live brief fields into bulk pre-blog skeleton (preserves Semrush CSV extras on skeleton). */
export function mergeSeoBriefIntoBulkSkeleton(
  skeleton: Record<string, unknown>,
  brief: SeoContentBriefV1,
): void {
  Object.assign(skeleton, brief);
}
