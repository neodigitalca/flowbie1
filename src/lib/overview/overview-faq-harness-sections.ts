import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { FaqEntry } from "@/lib/faq-entries";

export type PlannedFaqPairSection = {
  title: string;
  pairIndex: number;
  sectionIndex: number;
};

export function faqPairSectionTitle(pairIndex: number): string {
  return `FAQ ${pairIndex + 1}`;
}

export function buildPlannedFaqPairSections(pairCount: number): PlannedFaqPairSection[] {
  const n = Math.max(0, Math.floor(pairCount));
  return Array.from({ length: n }, (_, pairIndex) => ({
    title: faqPairSectionTitle(pairIndex),
    pairIndex,
    sectionIndex: pairIndex,
  }));
}

export function buildWaitingFaqHarnessSections(pairCount: number): HarnessSectionListItem[] {
  return buildPlannedFaqPairSections(pairCount).map(({ title, sectionIndex }) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export function formatFaqPairMarkdown(question: string, answer: string): string {
  const q = question.trim();
  const a = answer.trim();
  return `${q}\n\n${a}`.trim();
}

export function makeFaqPairHarnessStartPayload(
  rowIndex: number,
  pairIndex: number,
  totalSections: number,
  sectionIndex: number,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections,
    title: faqPairSectionTitle(pairIndex),
    phase: "start",
  };
}

export function makeFaqPairHarnessDonePayload(
  rowIndex: number,
  pairIndex: number,
  totalSections: number,
  sectionIndex: number,
  entry: FaqEntry,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections,
    title: faqPairSectionTitle(pairIndex),
    phase: "done",
    markdownSlice: formatFaqPairMarkdown(entry.question, entry.answer),
  };
}

function sanitizeFaqFilePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60) || "pair";
}

export function faqHarnessGeneratedFiles(
  sections: HarnessSectionListItem[],
  url: string,
): Array<{ name: string; content: string; mimeType: string }> {
  const slug = sanitizeFaqFilePart(
    url.replace(/^https?:\/\//i, "").replace(/\/+$/, "").split("/").pop() || "page",
  );
  return sections
    .filter((s) => s.status === "done" && s.markdown?.trim())
    .map((s) => ({
      name: `faq-${slug}-${sanitizeFaqFilePart(s.title || `section-${s.sectionIndex + 1}`)}.md`,
      content: s.markdown!.trim(),
      mimeType: "text/markdown",
    }));
}

export function buildDoneFaqHarnessSections(
  rowIndex: number,
  pairCount: number,
  entries: FaqEntry[],
  sectionIndexOffset = 0,
  totalSections?: number,
): HarnessSectionListItem[] {
  const total = totalSections ?? pairCount;
  let sections: HarnessSectionListItem[] = [];
  for (let pairIndex = 0; pairIndex < pairCount; pairIndex++) {
    const entry = entries[pairIndex];
    if (!entry) continue;
    const sectionIndex = sectionIndexOffset + pairIndex;
    for (const payload of [
      makeFaqPairHarnessStartPayload(rowIndex, pairIndex, total, sectionIndex),
      makeFaqPairHarnessDonePayload(rowIndex, pairIndex, total, sectionIndex, entry),
    ]) {
      sections = reduceHarnessSectionList(sections, payload);
    }
  }
  return sections;
}
