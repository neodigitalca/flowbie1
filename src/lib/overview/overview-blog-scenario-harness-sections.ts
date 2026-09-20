import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import {
  buildAiseoRowDisplaySections,
  filterAiseoRowDisplayFiles,
} from "@/lib/overview/overview-aiseo-row-artifacts";

export const SCENARIO_ROW_DISPLAY_FILE_NAMES = ["scenario.json", "wordpress.json"] as const;

export const SCENARIO_ROW_PIPELINE_TITLES = [
  "Case scenario",
  "Post content",
  "WordPress upload",
] as const;

export function scenarioRowPipelineFileName(title: string): string | null {
  if (title === "Case scenario") return "scenario.json";
  if (title === "Post content") return null;
  if (title === "WordPress upload") return "wordpress.json";
  return null;
}

export type ScenarioJsonArtifact = {
  h2Title: string;
  html: string;
};

export function buildScenarioJsonGeneratedFile(
  artifact: ScenarioJsonArtifact,
): { name: string; content: string; mimeType: string } | null {
  const html = artifact.html.trim();
  const h2Title = artifact.h2Title.trim();
  if (!html || !h2Title) return null;
  return {
    name: "scenario.json",
    content: JSON.stringify({ h2Title, html }, null, 2),
    mimeType: "application/json;charset=utf-8",
  };
}

export function scenarioGeneratedFileName(file: { name?: string; fileName?: string }): string {
  return file.name?.trim() || file.fileName?.trim() || "";
}

export function filterScenarioRowDisplayFiles<
  T extends { name?: string; fileName?: string },
>(files: T[]): T[] {
  return filterAiseoRowDisplayFiles("aiScenario", files);
}

export function buildScenarioRowDisplaySections(
  harness: Array<{ status?: string }> | undefined,
  files: Array<{ name: string }>,
): Array<{ sectionIndex: number; title: string; status: "waiting" | "generating" | "done" }> {
  return buildAiseoRowDisplaySections("aiScenario", harness, files);
}

export function makeScenarioHarnessStartPayload(
  rowIndex: number,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex: 0,
    totalSections: 1,
    title: "Case scenario",
    phase: "start",
  };
}

export function makeScenarioHarnessDonePayload(
  rowIndex: number,
  markdownSlice: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex: 0,
    totalSections: 1,
    title: "Case scenario",
    phase: "done",
    markdownSlice,
  };
}
