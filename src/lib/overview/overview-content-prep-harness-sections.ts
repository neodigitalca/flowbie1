import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import {
  CONTENT_OPTIMIZE_PIPELINE_TOTAL,
} from "./overview-content-optimize-pipeline";

/** Batch prep: separate posts and pages sitemap exports. */
export const CONTENT_PREP_BATCH_SECTION_TITLES = ["Posts sitemap", "Pages sitemap"] as const;

/** Entity/SAP runs: linking buckets plus the entity sitemap being optimized. */
export const CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES = [
  "Posts sitemap",
  "Pages sitemap",
  "Entity sitemap",
] as const;

/** Entity generator Details prep: full GSC keyword export (hosted link below buckets). */
export const ENTITY_SAP_GSC_PREP_SECTION_TITLE = "GSC keywords" as const;

export function resolveContentPrepBatchSectionTitles(isEntitySapRun: boolean): readonly string[] {
  return isEntitySapRun ? CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES : CONTENT_PREP_BATCH_SECTION_TITLES;
}

/** Entity Clusters pipeline: keywords, titles, meta in Details drawer. */
export const ENTITY_CLUSTER_PIPELINE_TITLES = [
  "Keywords from GSC",
  "SAP titles",
  "Meta descriptions",
] as const;

export type BulkHarnessSectionStatus = HarnessSectionListItem["status"];

export function buildEntityClusterLiveHarnessSections(
  phase: string,
): HarnessSectionListItem[] {
  const p = phase.trim().toLowerCase();
  let activeIndex = 0;
  if (p.includes("writing meta")) activeIndex = 2;
  else if (p.includes("writing titles")) activeIndex = 1;
  else if (p.includes("assigning") && p.includes("keyword")) activeIndex = 0;
  else if (p.includes("inventory") || p.includes("cache") || p.includes("gsc")) {
    return [];
  }

  return ENTITY_CLUSTER_PIPELINE_TITLES.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status:
      sectionIndex < activeIndex
        ? ("done" as const)
        : sectionIndex === activeIndex
          ? ("generating" as const)
          : ("waiting" as const),
  }));
}

export const CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS = CONTENT_PREP_BATCH_SECTION_TITLES.length;
export const CONTENT_PREP_ENTITY_SAP_BATCH_HARNESS_TOTAL_SECTIONS =
  CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES.length;

/** Combined step count (batch + one post) for legacy planned-section hints. */
export const CONTENT_PREP_HARNESS_TOTAL_SECTIONS =
  CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS + CONTENT_OPTIMIZE_PIPELINE_TOTAL;

export function buildWaitingBatchPrepHarnessSections(
  titles: readonly string[] = CONTENT_PREP_BATCH_SECTION_TITLES,
): HarnessSectionListItem[] {
  return titles.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export function buildWaitingEntitySapBatchPrepHarnessSections(): HarnessSectionListItem[] {
  return buildWaitingBatchPrepHarnessSections(CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES);
}

export function buildBatchPrepHarnessPayload(
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  markdownSlice?: string,
  titles: readonly string[] = CONTENT_PREP_BATCH_SECTION_TITLES,
): BulkHarnessSectionPayload {
  return {
    rowIndex: 0,
    sectionIndex,
    totalSections: titles.length,
    title: titles[sectionIndex] ?? `Step ${sectionIndex + 1}`,
    phase,
    ...(markdownSlice?.trim() ? { markdownSlice: markdownSlice.trim() } : {}),
  };
}

export function applyBatchPrepHarnessPayload(
  sections: HarnessSectionListItem[] | undefined,
  payload: BulkHarnessSectionPayload,
  waitingSections?: HarnessSectionListItem[],
): HarnessSectionListItem[] {
  const base = sections?.length ? sections : (waitingSections ?? buildWaitingBatchPrepHarnessSections());
  return reduceHarnessSectionList(base, payload);
}
