import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { reduceHarnessSectionList, type HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { AiAllMetaCatalogRow } from "@/lib/overview/overview-ai-all-meta-batch-catalog";
import type { AiAllMetaRowPatch } from "@/lib/overview/overview-ai-all-meta-batch-parse";
import type { MetaPageApiPingResult } from "@/lib/overview/overview-ai-all-meta-page-ping";
import { buildPlannedFaqPairSections } from "@/lib/overview/overview-faq-harness-sections";

export type MetaHarnessField =
  | "seoResearch"
  | "meta"
  | "title"
  | "faqPair";

export type PlannedMetaHarnessSection = {
  title: string;
  field: MetaHarnessField;
  pairIndex?: number;
};

export type MetaHarnessPrepSummaries = {
  pagePing?: MetaPageApiPingResult;
  seoResearchBrief?: string;
};

export function formatSeoResearchArtifact(brief: string | undefined): string {
  const trimmed = (brief ?? "").trim();
  if (!trimmed || trimmed === "(pending)" || trimmed === "(none)") {
    return "(none on row)\n\nNo SEO research brief was stored on this grid row before meta generation.";
  }
  return trimmed;
}

/** Prefer grid row brief; fall back to WordPress ACF `seo_research` from page ping. */
export function resolveMetaHarnessSeoResearchBrief(
  rowBrief: string | undefined,
  wpAcfBrief: string | undefined,
): string | undefined {
  const row = (rowBrief ?? "").trim();
  if (row && row !== "(pending)" && row !== "(none)") return row;
  const wp = (wpAcfBrief ?? "").trim();
  if (wp) return wp;
  return rowBrief;
}

export function buildPlannedMetaHarnessSections(
  row: AiAllMetaCatalogRow,
): PlannedMetaHarnessSection[] {
  const sections: PlannedMetaHarnessSection[] = [
    { title: "SEO research", field: "seoResearch" },
    { title: "Meta description", field: "meta" },
  ];
  if (row.includeTitle) {
    sections.push({ title: "Title", field: "title" });
  }
  if (row.faqMode !== "none") {
    for (const pair of buildPlannedFaqPairSections(row.faqPairCount)) {
      sections.push({
        title: pair.title,
        field: "faqPair",
        pairIndex: pair.pairIndex,
      });
    }
  }
  return sections;
}

export function metaHarnessNonFaqSectionCount(row: AiAllMetaCatalogRow): number {
  return buildPlannedMetaHarnessSections(row).filter((s) => s.field !== "faqPair").length;
}

export function metaHarnessPlannedSectionCount(row: AiAllMetaCatalogRow): number {
  return buildPlannedMetaHarnessSections(row).length;
}

export function buildWaitingMetaHarnessSections(row: AiAllMetaCatalogRow): HarnessSectionListItem[] {
  return buildPlannedMetaHarnessSections(row).map((section, sectionIndex) => ({
    sectionIndex,
    title: section.title,
    status: "waiting" as const,
  }));
}

function markdownForField(
  field: MetaHarnessField,
  patch: AiAllMetaRowPatch | null,
  prep?: MetaHarnessPrepSummaries,
): string {
  if (field === "seoResearch") {
    return formatSeoResearchArtifact(prep?.seoResearchBrief);
  }
  if (field === "faqPair") {
    return "";
  }
  if (!patch) return "";
  if (field === "meta") {
    return patch.metaDescription?.trim() || patch.aiMeta?.trim() || "";
  }
  if (field === "title") {
    return patch.title?.trim() || patch.aiTitle?.trim() || "";
  }
  return "";
}

export function makeMetaHarnessStartPayloads(
  rowIndex: number,
  row: AiAllMetaCatalogRow,
): BulkHarnessSectionPayload[] {
  const planned = buildPlannedMetaHarnessSections(row);
  const totalSections = planned.length;
  return planned.map((section, sectionIndex) => ({
    rowIndex,
    sectionIndex,
    totalSections,
    title: section.title,
    phase: "start" as const,
  }));
}

function sanitizeMetaFilePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60) || "section";
}

export function makeMetaHarnessDonePayloads(
  rowIndex: number,
  row: AiAllMetaCatalogRow,
  patch: AiAllMetaRowPatch | null,
  prep?: MetaHarnessPrepSummaries,
): BulkHarnessSectionPayload[] {
  const planned = buildPlannedMetaHarnessSections(row);
  const totalSections = planned.length;
  return planned
    .map((section, sectionIndex) => ({
      rowIndex,
      sectionIndex,
      totalSections,
      title: section.title,
      phase: "done" as const,
      markdownSlice: markdownForField(section.field, patch, prep),
    }))
    .filter((payload) => {
      const section = planned[payload.sectionIndex];
      return section && section.field !== "faqPair";
    });
}

export function buildDoneMetaHarnessSections(
  entry: AiAllMetaCatalogRow,
  patch: AiAllMetaRowPatch | null,
  prep?: MetaHarnessPrepSummaries,
): HarnessSectionListItem[] {
  let sections: HarnessSectionListItem[] = [];
  for (const payload of [
    ...makeMetaHarnessStartPayloads(entry.index, entry),
    ...makeMetaHarnessDonePayloads(entry.index, entry, patch, prep),
  ]) {
    sections = reduceHarnessSectionList(sections, payload);
  }
  return sections;
}

export function metaHarnessGeneratedFiles(
  sections: HarnessSectionListItem[],
  url: string,
): Array<{ name: string; content: string; mimeType: string }> {
  const slug = sanitizeMetaFilePart(
    url.replace(/^https?:\/\//i, "").replace(/\/+$/, "").split("/").pop() || "page",
  );
  return sections
    .filter((s) => s.status === "done" && s.markdown?.trim())
    .map((s) => ({
      name: `meta-${slug}-${sanitizeMetaFilePart(s.title || `section-${s.sectionIndex + 1}`)}.md`,
      content: s.markdown!.trim(),
      mimeType: "text/markdown",
    }));
}
