import { formatMetaChecklistForPrompt } from "@/lib/ppc/meta-ad-prompt-builder";
import type { MetaAdImageReferenceSummary } from "@/lib/ppc/meta-ad-image-reference-types";
import { buildCreativeBriefMarkdown } from "@/lib/ppc/meta-ad-creative-brief";
import type {
  MetaAdChecklistItem,
  MetaAdCreativeBrief,
  MetaAdInstagramGoal,
  MetaAdResearchSection,
  MetaAdResearchSectionStatus,
  MetaAdVisualReferenceElement,
} from "@/lib/ppc/meta-ads-types";
import { buildVisualReferencePlanMarkdown } from "@/lib/ppc/meta-ad-visual-reference-plan";

export const META_RESEARCH_SECTION_IDS = {
  flowbieAppContext: "flowbie-app-context",
  contextUrl: "context-url-research",
  landingPage: "landing-page-research",
  gscQueries: "gsc-queries",
  contextResearch: "context-research",
  instagramGoal: "instagram-ad-goal",
  creativeBrief: "creative-brief",
  strategyBrief: "strategy-brief",
  copyChecklist: "copy-checklist",
  imageChecklist: "image-checklist",
  visualReferencePlan: "visual-reference-plan",
  imageReferences: "image-references",
  creativePlan: "creative-plan",
} as const;

export const META_INTERNAL_RESEARCH_SECTION_IDS = new Set<string>([
  META_RESEARCH_SECTION_IDS.copyChecklist,
  META_RESEARCH_SECTION_IDS.imageChecklist,
  META_RESEARCH_SECTION_IDS.flowbieAppContext,
  META_RESEARCH_SECTION_IDS.contextUrl,
  META_RESEARCH_SECTION_IDS.landingPage,
  META_RESEARCH_SECTION_IDS.gscQueries,
  META_RESEARCH_SECTION_IDS.instagramGoal,
  META_RESEARCH_SECTION_IDS.creativeBrief,
  META_RESEARCH_SECTION_IDS.visualReferencePlan,
  META_RESEARCH_SECTION_IDS.imageReferences,
]);

export const META_RESEARCH_SECTION_TITLES: Record<string, string> = {
  [META_RESEARCH_SECTION_IDS.flowbieAppContext]: "FlowbieONE program brief",
  [META_RESEARCH_SECTION_IDS.contextUrl]: "Context URL research",
  [META_RESEARCH_SECTION_IDS.landingPage]: "Landing page research",
  [META_RESEARCH_SECTION_IDS.gscQueries]: "GSC queries",
  [META_RESEARCH_SECTION_IDS.contextResearch]: "Context research",
  [META_RESEARCH_SECTION_IDS.instagramGoal]: "Instagram ad goal",
  [META_RESEARCH_SECTION_IDS.creativeBrief]: "Creative brief",
  [META_RESEARCH_SECTION_IDS.strategyBrief]: "Strategy brief",
  [META_RESEARCH_SECTION_IDS.copyChecklist]: "Copy checklist",
  [META_RESEARCH_SECTION_IDS.imageChecklist]: "Image checklist",
  [META_RESEARCH_SECTION_IDS.visualReferencePlan]: "Visual reference plan",
  [META_RESEARCH_SECTION_IDS.imageReferences]: "Image references",
  [META_RESEARCH_SECTION_IDS.creativePlan]: "Creative plan",
};

function sanitizeResearchFilePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60) || "section";
}

export function createMetaResearchSection(
  id: string,
  status: MetaAdResearchSectionStatus,
  markdown?: string,
): MetaAdResearchSection {
  return {
    id,
    title: META_RESEARCH_SECTION_TITLES[id] ?? id,
    status,
    markdown,
  };
}

export function buildInstagramGoalMarkdown(goal: MetaAdInstagramGoal): string {
  return [
    "# Instagram ad goal",
    "",
    `## Goal statement`,
    goal.goalStatement,
    "",
    `## Primary topic`,
    goal.primaryTopic,
    "",
    `## Audience`,
    goal.audience,
    "",
    `## Ad angle`,
    goal.adAngle,
    "",
    `## Hook`,
    goal.hook,
    "",
    `## Visual direction`,
    goal.visualDirection,
    "",
    `## Creative mode`,
    goal.creativeMode,
    "",
    `## On-image text hint`,
    goal.onImageTextHint?.trim() || "none",
    "",
    `## Reference queries`,
    ...goal.referenceQueries.map((item) => `- ${item}`),
  ].join("\n");
}

export function buildCreativeBriefSectionMarkdown(brief: MetaAdCreativeBrief): string {
  return buildCreativeBriefMarkdown(brief);
}

export function buildChecklistMarkdown(title: string, items: MetaAdChecklistItem[]): string {
  return [`# ${title}`, "", formatMetaChecklistForPrompt(items)].join("\n");
}

export function buildVisualReferencePlanSectionMarkdown(
  elements: MetaAdVisualReferenceElement[],
): string {
  return buildVisualReferencePlanMarkdown(elements);
}

export function buildImageReferencesMarkdown(references: MetaAdImageReferenceSummary[]): string {
  if (!references.length) return "# Image references\n\nNo references selected.";
  return [
    "# Image references",
    "",
    ...references.map(
      (ref, index) =>
        `${index + 1}. **${ref.elementLabel || ref.role}** (${ref.source})\n   Query: ${ref.query}\n   ${ref.visualDescription || ref.why || ""}`.trim(),
    ),
  ].join("\n\n");
}

export function upsertMetaResearchSection(
  sections: MetaAdResearchSection[],
  section: MetaAdResearchSection,
): MetaAdResearchSection[] {
  const index = sections.findIndex((row) => row.id === section.id);
  if (index < 0) return [...sections, section];
  const next = [...sections];
  next[index] = section;
  return next;
}

function collectSectionMarkdown(sections: MetaAdResearchSection[], ids: string[]): string {
  return ids
    .map((id) => sections.find((section) => section.id === id && section.status === "done")?.markdown?.trim())
    .filter(Boolean)
    .join("\n\n---\n\n");
}

export function buildMergedContextResearchMarkdown(sections: MetaAdResearchSection[]): string {
  const body = collectSectionMarkdown(sections, [
    META_RESEARCH_SECTION_IDS.flowbieAppContext,
    META_RESEARCH_SECTION_IDS.contextUrl,
    META_RESEARCH_SECTION_IDS.landingPage,
    META_RESEARCH_SECTION_IDS.gscQueries,
  ]);
  if (!body) return "";
  return `# Context research\n\n${body}`;
}

export function buildMergedStrategyBriefMarkdown(sections: MetaAdResearchSection[]): string {
  const body = collectSectionMarkdown(sections, [
    META_RESEARCH_SECTION_IDS.instagramGoal,
    META_RESEARCH_SECTION_IDS.creativeBrief,
  ]);
  if (!body) return "";
  return `# Strategy brief\n\n${body}`;
}

export function buildMergedCreativePlanMarkdown(
  sections: MetaAdResearchSection[],
  imageReferencesMarkdown?: string,
): string {
  const parts = [
    sections.find((section) => section.id === META_RESEARCH_SECTION_IDS.visualReferencePlan)?.markdown?.trim(),
    imageReferencesMarkdown?.trim() ||
      sections.find((section) => section.id === META_RESEARCH_SECTION_IDS.imageReferences)?.markdown?.trim(),
  ].filter(Boolean);
  if (!parts.length) return "";
  return `# Creative plan\n\n${parts.join("\n\n---\n\n")}`;
}

export function syncMetaMergedResearchSections(sections: MetaAdResearchSection[]): MetaAdResearchSection[] {
  let next = [...sections];
  const contextMarkdown = buildMergedContextResearchMarkdown(next);
  if (contextMarkdown) {
    next = upsertMetaResearchSection(
      next,
      createMetaResearchSection(META_RESEARCH_SECTION_IDS.contextResearch, "done", contextMarkdown),
    );
  }
  const strategyMarkdown = buildMergedStrategyBriefMarkdown(next);
  if (strategyMarkdown) {
    next = upsertMetaResearchSection(
      next,
      createMetaResearchSection(META_RESEARCH_SECTION_IDS.strategyBrief, "done", strategyMarkdown),
    );
  }
  const creativePlanMarkdown = buildMergedCreativePlanMarkdown(next);
  if (creativePlanMarkdown) {
    next = upsertMetaResearchSection(
      next,
      createMetaResearchSection(META_RESEARCH_SECTION_IDS.creativePlan, "done", creativePlanMarkdown),
    );
  }
  return next;
}

export function metaAdResearchDownloadFiles(
  sections: MetaAdResearchSection[],
  slug = "meta-ad",
): Array<{ name: string; content: string; mimeType: string }> {
  return sections
    .filter((section) => section.status === "done" && section.markdown?.trim())
    .map((section) => ({
      name: `research-${sanitizeResearchFilePart(slug)}-${sanitizeResearchFilePart(section.title)}.md`,
      content: section.markdown!.trim(),
      mimeType: "text/markdown",
    }));
}

export function triggerMetaResearchDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
