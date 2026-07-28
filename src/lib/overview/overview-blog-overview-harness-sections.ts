import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";

export const OVERVIEW_HARNESS_SECTION_TITLES = ["Analyze", "Overview"] as const;

export const OVERVIEW_STEP_ANALYZE = 0;
export const OVERVIEW_STEP_OVERVIEW = 1;

export function buildWaitingOverviewHarnessSections(): HarnessSectionListItem[] {
  return OVERVIEW_HARNESS_SECTION_TITLES.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export function makeOverviewHarnessStartPayload(
  rowIndex: number,
  sectionIndex: number,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: OVERVIEW_HARNESS_SECTION_TITLES.length,
    title: OVERVIEW_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "start",
  };
}

export function makeOverviewHarnessDonePayload(
  rowIndex: number,
  sectionIndex: number,
  markdownSlice: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: OVERVIEW_HARNESS_SECTION_TITLES.length,
    title: OVERVIEW_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "done",
    markdownSlice,
  };
}

export function formatOverviewAnalyzeMarkdown(bodyH2Titles: string[]): string {
  if (!bodyH2Titles.length) {
    return "EXISTING H2s: none in body HTML (Overview will still prepend).";
  }
  const lines = [`EXISTING H2s (${bodyH2Titles.length}):`, ""];
  for (let i = 0; i < bodyH2Titles.length; i += 1) {
    lines.push(`  ${i + 1}. ${bodyH2Titles[i]}`);
  }
  return lines.join("\n");
}

export function formatOverviewSectionMarkdown(overviewHtml: string): string {
  const html = overviewHtml.trim();
  if (!html) return "Overview HTML: empty.";
  return ["# Overview", "", "```html", html, "```"].join("\n");
}
