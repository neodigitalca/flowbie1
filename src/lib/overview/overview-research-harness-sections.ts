import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";

export const RESEARCH_HARNESS_SECTION_TITLES = [
  "DataForSEO SERP",
  "GSC CSV",
  "Semrush enrichment",
  "SERP dump load",
  "GSC quick-wins context",
  "Brief merge",
  "Brief upload",
] as const;

export const RESEARCH_HARNESS_TOTAL_SECTIONS = RESEARCH_HARNESS_SECTION_TITLES.length;

export type PlannedResearchHarnessSection = {
  title: string;
  sectionIndex: number;
};

export function buildPlannedResearchHarnessSections(): PlannedResearchHarnessSection[] {
  return RESEARCH_HARNESS_SECTION_TITLES.map((title, sectionIndex) => ({
    title,
    sectionIndex,
  }));
}

export function buildWaitingResearchHarnessSections(): HarnessSectionListItem[] {
  return buildPlannedResearchHarnessSections().map(({ title, sectionIndex }) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export function makeResearchHarnessStartPayloads(rowIndex: number): BulkHarnessSectionPayload[] {
  const planned = buildPlannedResearchHarnessSections();
  const totalSections = planned.length;
  return planned.map(({ title, sectionIndex }) => ({
    rowIndex,
    sectionIndex,
    totalSections,
    title,
    phase: "start" as const,
  }));
}

export type ResearchHarnessDoneSummary = Partial<
  Record<(typeof RESEARCH_HARNESS_SECTION_TITLES)[number], string>
>;

export function makeResearchHarnessDonePayloads(
  rowIndex: number,
  summaries?: ResearchHarnessDoneSummary,
): BulkHarnessSectionPayload[] {
  const planned = buildPlannedResearchHarnessSections();
  const totalSections = planned.length;
  return planned.map(({ title, sectionIndex }) => ({
    rowIndex,
    sectionIndex,
    totalSections,
    title,
    phase: "done" as const,
    markdownSlice: summaries?.[title as keyof ResearchHarnessDoneSummary]?.trim() || undefined,
  }));
}

export function buildDoneResearchHarnessSections(
  rowIndex: number,
  summaries?: ResearchHarnessDoneSummary,
): HarnessSectionListItem[] {
  let sections: HarnessSectionListItem[] = [];
  for (const payload of [
    ...makeResearchHarnessStartPayloads(rowIndex),
    ...makeResearchHarnessDonePayloads(rowIndex, summaries),
  ]) {
    sections = reduceHarnessSectionList(sections, payload);
  }
  return sections;
}

function sanitizeResearchFilePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60) || "section";
}

export function researchHarnessGeneratedFiles(
  sections: HarnessSectionListItem[],
  url: string,
): Array<{ name: string; content: string; mimeType: string }> {
  const slug = sanitizeResearchFilePart(
    url.replace(/^https?:\/\//i, "").replace(/\/+$/, "").split("/").pop() || "page",
  );
  return sections
    .filter((s) => s.status === "done" && s.markdown?.trim())
    .map((s) => ({
      name: `research-${slug}-${sanitizeResearchFilePart(s.title || `section-${s.sectionIndex + 1}`)}.md`,
      content: s.markdown!.trim(),
      mimeType: "text/markdown",
    }));
}
