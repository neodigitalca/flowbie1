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
    (phase.includes("writing titles") || phase.includes("writing meta")) &&
    headerProgress.completed < headerProgress.total
  ) {
    return Math.min(headerProgress.completed, displayRowsLength - 1);
  }

  return -1;
}
