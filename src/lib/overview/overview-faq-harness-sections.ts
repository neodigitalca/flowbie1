import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { FaqEntry } from "@/lib/faq-entries";
import {
  AISEO_POST_CONTENT_SLOT_TITLE,
  AISEO_WP_UPLOAD_SLOT_TITLE,
  aiseoPostContentFileSlug,
  buildAiseoPostContentHtmlFile,
  buildAiseoRowDisplaySections,
  filterAiseoRowDisplayFiles,
  findAiseoPostContentFile,
  generatedFileName,
  isAiseoPostContentFileName,
} from "@/lib/overview/overview-aiseo-row-artifacts";

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

/** Overview FAQ batch: one JSON artifact for the row (not per-pair markdown files). */
export function buildFaqJsonGeneratedFile(
  entries: FaqEntry[],
): { name: string; content: string; mimeType: string } | null {
  const cleaned = entries
    .map((entry) => ({
      question: entry.question.trim(),
      answer: entry.answer.trim(),
    }))
    .filter((entry) => entry.question || entry.answer);
  if (!cleaned.length) return null;
  return {
    name: "faq.json",
    content: JSON.stringify(cleaned, null, 2),
    mimeType: "application/json;charset=utf-8",
  };
}

export const faqPostContentFileSlug = aiseoPostContentFileSlug;
export const isFaqPostContentFileName = isAiseoPostContentFileName;
export const buildFaqPostContentHtmlFile = buildAiseoPostContentHtmlFile;
export const FAQ_ROW_PIPELINE_TITLES = [
  "FAQ",
  AISEO_POST_CONTENT_SLOT_TITLE,
  AISEO_WP_UPLOAD_SLOT_TITLE,
] as const;
export const findFaqPostContentFile = findAiseoPostContentFile;
export const faqGeneratedFileName = generatedFileName;

export function faqRowPipelineFileName(title: string): string | null {
  if (title === "FAQ") return "faq.json";
  if (title === AISEO_POST_CONTENT_SLOT_TITLE) return null;
  if (title === AISEO_WP_UPLOAD_SLOT_TITLE) return "wordpress.json";
  return null;
}

export function buildFaqRowDisplaySections(
  pairHarness: Array<{ status?: string }> | undefined,
  files: Array<{ name: string }>,
): Array<{ sectionIndex: number; title: string; status: "waiting" | "generating" | "done" }> {
  return buildAiseoRowDisplaySections("aiFaq", pairHarness, files);
}

export function filterFaqRowDisplayFiles<
  T extends { name?: string; fileName?: string },
>(files: T[]): T[] {
  return filterAiseoRowDisplayFiles("aiFaq", files);
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
