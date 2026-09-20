import { AGENT_RUN_STEP_KEYS, gscSectionStepKey } from "@/lib/agent-runs/agent-run-step-keys";
import { ADS_REPORTING_PROGRESS_LABELS } from "@/lib/ads-reporting/ads-reporting-types";

export function formatAdsBundleApiLabel(compareLabel: string): string {
  const period = compareLabel.trim();
  return period ? `${ADS_REPORTING_PROGRESS_LABELS.bundleApi} · ${period}` : ADS_REPORTING_PROGRESS_LABELS.bundleApi;
}

export function formatAdsBundleReadyLabel(files: { name: string }[], compareLabel: string): string {
  const names = files.map((file) => file.name.trim()).filter(Boolean);
  const filePart = names.length > 0 ? `${names.length} files (${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""})` : "0 files";
  const period = compareLabel.trim();
  return period ? `Ads reporting bundle ready: ${filePart} · ${period}` : `Ads reporting bundle ready: ${filePart}`;
}

export function formatAdsOutlineCompleteLabel(sections: { h2Title: string }[]): string {
  const titles = sections.map((section) => section.h2Title.trim()).filter(Boolean);
  if (titles.length === 0) return ADS_REPORTING_PROGRESS_LABELS.outlineComplete;
  return `Outline complete: ${titles.length} sections (${titles.slice(0, 3).join(", ")}${titles.length > 3 ? ` +${titles.length - 3} more` : ""})`;
}

export function formatAdsSectionCompleteLabel(sectionIndex: number, sectionTotal: number, h2Title: string): string {
  return `Section ${sectionIndex + 1}/${sectionTotal}: ${h2Title.trim().slice(0, 48)} complete`;
}

export function resolveAdsAgentProgressStepKey(
  label: string,
  resumePayload?: Record<string, unknown>,
): string {
  const phase = typeof resumePayload?.phase === "string" ? resumePayload.phase : "";
  if (phase === "ads_fetch") return AGENT_RUN_STEP_KEYS.gscBundleApi;
  if (phase === "ads_outline") return AGENT_RUN_STEP_KEYS.gscBundleReady;
  if (phase === "ads_outline_generating") return AGENT_RUN_STEP_KEYS.gscOutlineGenerating;
  if (label.trim().startsWith("Outline complete")) return AGENT_RUN_STEP_KEYS.gscOutline;
  const sectionIndex = resumePayload?.sectionIndex;
  if (typeof sectionIndex === "number" && sectionIndex >= 0) return gscSectionStepKey(sectionIndex);
  return AGENT_RUN_STEP_KEYS.gscSection;
}
