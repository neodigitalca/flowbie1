import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";

export const WP_UPLOAD_HARNESS_SECTION_TITLES = ["WordPress upload"] as const;

export const WP_UPLOAD_HARNESS_TOTAL_SECTIONS = WP_UPLOAD_HARNESS_SECTION_TITLES.length;

export function buildWaitingWpUploadHarnessSections(): HarnessSectionListItem[] {
  return WP_UPLOAD_HARNESS_SECTION_TITLES.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export type WpUploadHarnessDoneSummary = Partial<
  Record<(typeof WP_UPLOAD_HARNESS_SECTION_TITLES)[number], string>
>;

export function buildDoneWpUploadHarnessSections(
  summaries?: WpUploadHarnessDoneSummary,
): HarnessSectionListItem[] {
  let sections: HarnessSectionListItem[] = buildWaitingWpUploadHarnessSections();
  const totalSections = WP_UPLOAD_HARNESS_TOTAL_SECTIONS;
  for (let sectionIndex = 0; sectionIndex < totalSections; sectionIndex += 1) {
    const title = WP_UPLOAD_HARNESS_SECTION_TITLES[sectionIndex];
    const markdownSlice = summaries?.[title]?.trim() || undefined;
    const payload: BulkHarnessSectionPayload = {
      rowIndex: 0,
      sectionIndex,
      totalSections,
      title,
      phase: "done",
      markdownSlice,
    };
    sections = reduceHarnessSectionList(sections, payload);
  }
  return sections;
}
