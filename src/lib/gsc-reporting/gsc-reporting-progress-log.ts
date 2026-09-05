import { AGENT_RUN_STEP_KEYS, gscSectionStepKey } from "@/lib/agent-runs/agent-run-step-keys";
import { GSC_REPORTING_PROGRESS_LABELS } from "@/lib/gsc-reporting/gsc-reporting-types";

export function formatGscBundleApiLabel(compareLabel: string): string {
  const period = compareLabel.trim();
  return period
    ? `${GSC_REPORTING_PROGRESS_LABELS.bundleApi} · ${period}`
    : GSC_REPORTING_PROGRESS_LABELS.bundleApi;
}

export function formatGscBundleReadyLabel(
  files: { name: string }[],
  compareLabel: string,
): string {
  const names = files
    .map((file) => file.name.trim())
    .filter((name) => name.length > 0 && name !== "Queries-AI-clusters.md");
  const count = names.length;
  const preview = names.slice(0, 3).join(", ");
  const suffix = count > 3 ? ` +${count - 3} more` : "";
  const filePart = count > 0 ? `${count} files (${preview}${suffix})` : "0 files";
  const period = compareLabel.trim();
  return period
    ? `GSC reporting bundle ready: ${filePart} · ${period}`
    : `GSC reporting bundle ready: ${filePart}`;
}

export function formatGscOutlineCompleteLabel(sections: { h2Title: string }[]): string {
  const titles = sections.map((section) => section.h2Title.trim()).filter((title) => title.length > 0);
  const count = titles.length;
  if (count === 0) return GSC_REPORTING_PROGRESS_LABELS.outlineComplete;
  const preview = titles.slice(0, 3).join(", ");
  const suffix = count > 3 ? ` +${count - 3} more` : "";
  return `Outline complete: ${count} sections (${preview}${suffix})`;
}

export function formatGscSectionCompleteLabel(
  sectionIndex: number,
  sectionTotal: number,
  h2Title: string,
): string {
  const title = h2Title.trim().slice(0, 48);
  return `Section ${sectionIndex + 1}/${sectionTotal}: ${title} complete`;
}

export function resolveGscAgentProgressStepKey(
  label: string,
  resumePayload?: Record<string, unknown>,
): string {
  const phase = typeof resumePayload?.phase === "string" ? resumePayload.phase : "";
  if (phase === "gsc_fetch") return AGENT_RUN_STEP_KEYS.gscBundleApi;
  if (phase === "gsc_outline") return AGENT_RUN_STEP_KEYS.gscBundleReady;
  if (phase === "gsc_outline_generating") return AGENT_RUN_STEP_KEYS.gscOutlineGenerating;
  if (label.trim().startsWith("Outline complete")) {
    return AGENT_RUN_STEP_KEYS.gscOutline;
  }
  const sectionIndex = resumePayload?.sectionIndex;
  if (typeof sectionIndex === "number" && sectionIndex >= 0) {
    return gscSectionStepKey(sectionIndex);
  }
  return AGENT_RUN_STEP_KEYS.gscSection;
}
