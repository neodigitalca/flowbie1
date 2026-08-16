import type { LocalAnalysisHeaderProgress } from "@/lib/local-analysis/header-progress";

export function resolveEntityDetailsCurrentRow(
  headerProgress: LocalAnalysisHeaderProgress | null | undefined,
  workspaceBusy: boolean,
  displayRowsLength: number,
): number {
  if (!workspaceBusy || !headerProgress || displayRowsLength <= 0) return -1;

  for (const group of headerProgress.titleHarnessGroups ?? []) {
    for (const entity of group.entities) {
      if (entity.status === "generating") return entity.rowIndex;
    }
    if (group.status === "generating") {
      const first = group.entities.find((e) => e.status !== "done");
      if (first) return first.rowIndex;
    }
  }

  const phase = headerProgress.phase.trim().toLowerCase();
  if (
    phase.includes("syncing locations") ||
    (phase.includes("loading") && (phase.includes("gsc") || phase.includes("inventory")))
  ) {
    return 0;
  }
  if (phase.includes("assigning") && phase.includes("keyword")) {
    return Math.min(Math.max(0, headerProgress.completed), displayRowsLength - 1);
  }
  if (
    phase.includes("loading site inventory") ||
    phase.includes("grepping wiki") ||
    (phase.includes("inventory") && phase.includes("cache"))
  ) {
    return 0;
  }
  if (
    (phase.includes("writing titles") || phase.includes("writing meta")) &&
    headerProgress.completed < headerProgress.total
  ) {
    return Math.min(headerProgress.completed, displayRowsLength - 1);
  }

  return -1;
}
