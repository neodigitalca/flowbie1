import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";

export const IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES = [
  "Analyze",
  "Checklist",
  "Generate",
  "Insert",
] as const;

export const IN_CONTENT_STEP_ANALYZE = 0;
export const IN_CONTENT_STEP_CHECKLIST = 1;
export const IN_CONTENT_STEP_GENERATE = 2;
export const IN_CONTENT_STEP_INSERT = 3;

export function buildWaitingInContentImageHarnessSections(): HarnessSectionListItem[] {
  return IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export function makeInContentImageHarnessStartPayload(
  rowIndex: number,
  sectionIndex: number,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
    title: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "start",
  };
}

export function makeInContentImageHarnessDonePayload(
  rowIndex: number,
  sectionIndex: number,
  markdownSlice: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
    title: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "done",
    markdownSlice,
  };
}

export function makeInContentImageHarnessProgressPayload(
  rowIndex: number,
  sectionIndex: number,
  markdownSlice: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
    title: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "progress",
    markdownSlice,
  };
}

export function formatInContentAnalyzeMarkdown(bodyH2Titles: string[]): string {
  if (!bodyH2Titles.length) {
    return "EXISTING H2s: none (cannot place in-content image).";
  }
  const lines = [`EXISTING H2s (${bodyH2Titles.length}):`, ""];
  for (let i = 0; i < bodyH2Titles.length; i += 1) {
    lines.push(`  ${i + 1}. ${bodyH2Titles[i]}`);
  }
  return lines.join("\n");
}

export function formatInContentImageResultMarkdown(params: {
  sectionHeader: string;
  imageUrl: string;
  alt: string;
  referenceImageUrl?: string;
  referenceSourceUrl?: string;
  /** Reused peer image vs AI-generated from a reference. */
  action?: "Reused peer image" | "Generated from reference";
  entity?: string;
  sourceSiteName?: string;
  sourcePageUrl?: string;
}): string {
  const lines = [`# In Content Image`, ""];
  const action = (params.action ?? "").trim();
  if (action) lines.push(`Action: ${action}`);
  const entity = (params.entity ?? "").trim();
  if (entity) lines.push(`Place: ${entity}`);
  lines.push(`Section: ${params.sectionHeader}`);
  lines.push(`Alt: ${params.alt}`);
  lines.push(`URL: ${params.imageUrl}`);
  const sourceSite = (params.sourceSiteName ?? "").trim();
  if (sourceSite) lines.push(`Source site: ${sourceSite}`);
  const sourcePage =
    (params.sourcePageUrl ?? "").trim() || (params.referenceSourceUrl ?? "").trim();
  if (sourcePage) lines.push(`Source page: ${sourcePage}`);
  const refImg = (params.referenceImageUrl ?? "").trim();
  if (refImg) lines.push(`Source image: ${refImg}`);
  return lines.join("\n");
}

export type LocalImageRowOutcome = "found" | "generated" | "skipped";

export const LOCAL_IMAGE_BATCH_SUMMARY_FILENAME = "local-image-summary.md";

/** One batch markdown summarizing every Local Image row (download once). */
export function formatLocalImageBatchSummaryMarkdown(params: {
  rows: Array<{
    url: string;
    keyword?: string;
    outcome: LocalImageRowOutcome | "error";
    reportMarkdown?: string;
    skipReason?: string;
  }>;
}): string {
  const rows = params.rows ?? [];
  const found = rows.filter((r) => r.outcome === "found").length;
  const generated = rows.filter((r) => r.outcome === "generated").length;
  const skipped = rows.filter((r) => r.outcome === "skipped").length;
  const errored = rows.filter((r) => r.outcome === "error").length;
  const lines = [
    "# Local Image Summary",
    "",
    `Total: ${rows.length}`,
    `Found (peer): ${found}`,
    `Generated: ${generated}`,
    `Skipped: ${skipped}`,
    `Failed: ${errored}`,
    "",
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]!;
    const label = (r.keyword || r.url || "").trim() || `Row ${i + 1}`;
    lines.push(`## ${i + 1}. ${label}`);
    lines.push(`Outcome: ${r.outcome}`);
    lines.push(`URL: ${r.url}`);
    if (r.outcome === "skipped" && (r.skipReason || "").trim()) {
      lines.push(`Reason: ${r.skipReason!.trim()}`);
    }
    const report = (r.reportMarkdown || "").trim();
    if (report) {
      lines.push("");
      lines.push(report);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export function rebuildLocalImageBatchSummaryFile(params: {
  urls: string[];
  urlKeywords?: Record<string, string>;
  urlOutcomes?: Record<string, LocalImageRowOutcome | "error">;
  urlSkipReasons?: Record<string, string>;
  urlGeneratedFiles?: Record<
    string,
    Array<{ name: string; content: string; mimeType: string }>
  >;
}): { name: string; content: string; mimeType: string } {
  const rows = (params.urls ?? []).map((url) => {
    const outcome = params.urlOutcomes?.[url] || "error";
    const report = (params.urlGeneratedFiles?.[url] || []).find(
      (f) => f.name === "in-content-image.md",
    )?.content;
    return {
      url,
      keyword: params.urlKeywords?.[url],
      outcome,
      reportMarkdown: report,
      skipReason: params.urlSkipReasons?.[url],
    };
  });
  return {
    name: LOCAL_IMAGE_BATCH_SUMMARY_FILENAME,
    content: formatLocalImageBatchSummaryMarkdown({ rows }),
    mimeType: "text/markdown;charset=utf-8",
  };
}

/** Checklist rules shown in harness Details for Local Image replicate. */
export function formatLocalImageChecklistMarkdown(params: {
  entity: string;
  referenceImageUrl: string;
  referenceSourceUrl?: string;
}): string {
  const lines = [
    `# Local Image checklist`,
    "",
    `Place entity: ${params.entity}`,
  ];
  const source = (params.referenceSourceUrl ?? "").trim();
  if (source) lines.push(`Source page: ${source}`);
  lines.push(`Source image: ${params.referenceImageUrl}`);
  lines.push(
    "",
    "- Prefer the entity Wikipedia lead photograph when it is a usable community photo.",
    "- Prefer community-scale views (streetscape, park, school, plaza) over a single private house listing.",
    "- Do not reject houses as a category; rank community overview higher when both exist.",
    "- Replicate the reference photograph exactly.",
    "- Do not embellish, stylize, enhance, restyle, or invent new elements.",
    "- Do not alter composition, architecture, materials, lighting, or viewpoint.",
    "- No people, animals, text, logos, watermarks, or brand storefronts.",
    "- Faithful visual copy of the reference only.",
  );
  return lines.join("\n");
}

/** Peer Local Image Checklist status (Details: City sitemap peers holds links/CSVs). */
export function formatPeerLocalImageLibraryChecklistMarkdown(params: {
  entity: string;
  peerFileNames: string[];
  reusedFrom?: string;
}): string {
  const lines = [
    `# Same-city peer Local Image libraries`,
    "",
    `Place entity: ${params.entity}`,
  ];
  const reused = (params.reusedFrom ?? "").trim();
  if (reused) {
    lines.push(`Reused from: ${reused}`);
  } else {
    lines.push("Reused from: none (no peer body image for this entity)");
  }
  lines.push("");
  const n = params.peerFileNames.length;
  if (!n) {
    lines.push("Peer CSV libraries: none");
  } else {
    lines.push(
      `Peer CSV libraries: ${n}. Download peer-local-images.csv once from Details (batch).`,
    );
  }
  return lines.join("\n");
}

export type LocalImagePhaseKind =
  | "looking"
  | "found"
  | "not_found"
  | "reusing"
  | "generating";

export type LocalImagePhaseInfo = {
  phase: LocalImagePhaseKind;
  detail?: string;
};

/** One line for Generate progress / progress band. */
export function formatLocalImagePhaseLine(info: LocalImagePhaseInfo): string {
  const detail = (info.detail ?? "").trim();
  if (detail) return detail;
  switch (info.phase) {
    case "looking":
      return "Looking for image";
    case "found":
      return "Found";
    case "not_found":
      return "Not found";
    case "reusing":
      return "Uploading peer image";
    case "generating":
      return "Generating image";
    default:
      return "Local Image";
  }
}

/** Append a phase line to the Generate progress log (newest last). */
export function appendLocalImagePhaseLog(
  previousLog: string,
  info: LocalImagePhaseInfo,
): string {
  const line = formatLocalImagePhaseLine(info);
  const prev = (previousLog ?? "").trim();
  if (!prev) return line;
  if (prev.endsWith(line)) return prev;
  return `${prev}\n${line}`;
}
