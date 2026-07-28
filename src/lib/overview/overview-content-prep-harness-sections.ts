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

export function resolveContentPrepBatchSectionTitles(isEntitySapRun: boolean): readonly string[] {
  return isEntitySapRun ? CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES : CONTENT_PREP_BATCH_SECTION_TITLES;
}

/** Per-post steps shown inside each post dropdown. */
export const CONTENT_PREP_POST_SECTION_TITLES = [
  "SERP research brief",
  "Blueprint and content",
] as const;

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
