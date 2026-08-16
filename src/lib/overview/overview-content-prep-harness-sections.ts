import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";

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

/** Per-post steps shown inside each post dropdown. */
export const CONTENT_PREP_POST_SECTION_TITLES = [
  "SERP research brief",
  "Blueprint and content",
] as const;

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
        ? ("done" as BulkHarnessSectionStatus)
        : sectionIndex === activeIndex
          ? ("generating" as BulkHarnessSectionStatus)
          : ("waiting" as BulkHarnessSectionStatus),
    ...(sectionIndex === activeIndex && phase.trim() ? { markdown: phase.trim() } : {}),
  }));
}

export const CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS = CONTENT_PREP_BATCH_SECTION_TITLES.length;
export const CONTENT_PREP_ENTITY_SAP_BATCH_HARNESS_TOTAL_SECTIONS =
  CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES.length;
export const CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS = CONTENT_PREP_POST_SECTION_TITLES.length;

/** Combined step count (batch + one post) for legacy planned-section hints. */
export const CONTENT_PREP_HARNESS_TOTAL_SECTIONS =
  CONTENT_PREP_BATCH_HARNESS_TOTAL_SECTIONS + CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS;

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

export function buildWaitingPostHarnessSections(): HarnessSectionListItem[] {
  return CONTENT_PREP_POST_SECTION_TITLES.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

/** @deprecated Use buildWaitingPostHarnessSections */
export function buildWaitingContentPrepHarnessSections(): HarnessSectionListItem[] {
  return buildWaitingPostHarnessSections();
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

export function buildPostPrepHarnessPayload(
  rowIndex: number,
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  markdownSlice?: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: CONTENT_PREP_POST_HARNESS_TOTAL_SECTIONS,
    title: CONTENT_PREP_POST_SECTION_TITLES[sectionIndex] ?? `Step ${sectionIndex + 1}`,
    phase,
    ...(markdownSlice?.trim() ? { markdownSlice: markdownSlice.trim() } : {}),
  };
}

/** @deprecated Use buildPostPrepHarnessPayload */
export function buildContentPrepHarnessPayload(
  rowIndex: number,
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  markdownSlice?: string,
): BulkHarnessSectionPayload {
  return buildPostPrepHarnessPayload(rowIndex, sectionIndex, phase, markdownSlice);
}

export function applyBatchPrepHarnessPayload(
  sections: HarnessSectionListItem[] | undefined,
  payload: BulkHarnessSectionPayload,
  waitingSections?: HarnessSectionListItem[],
): HarnessSectionListItem[] {
  const base = sections?.length ? sections : (waitingSections ?? buildWaitingBatchPrepHarnessSections());
  return reduceHarnessSectionList(base, payload);
}

export function applyPostPrepHarnessPayload(
  sections: HarnessSectionListItem[] | undefined,
  payload: BulkHarnessSectionPayload,
): HarnessSectionListItem[] {
  const base = sections?.length ? sections : buildWaitingPostHarnessSections();
  return reduceHarnessSectionList(base, payload);
}

/** @deprecated Use applyPostPrepHarnessPayload */
export function applyContentPrepHarnessPayload(
  sections: HarnessSectionListItem[] | undefined,
  payload: BulkHarnessSectionPayload,
): HarnessSectionListItem[] {
  return applyPostPrepHarnessPayload(sections, payload);
}
