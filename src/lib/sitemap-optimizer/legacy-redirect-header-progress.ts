import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { LegacyRedirectHeaderProgress } from "@/lib/sitemap-optimizer/types";

export const LEGACY_REDIRECT_PHASES = [
  "Load site inventory",
  "Match redirects",
  "Build Rank Math CSV",
] as const;

export function legacyRedirectProgressBusy(
  progress: LegacyRedirectHeaderProgress | null | undefined,
): boolean {
  return Boolean(progress?.phase?.trim());
}

export function activeLegacyRedirectPhaseIndex(currentPhase: string): number {
  const norm = currentPhase.trim().toLowerCase();
  if (!norm) return -1;
  if (norm.includes("inventory")) return 0;
  if (norm.includes("match")) return 1;
  if (norm.includes("rank math") || norm.includes("build")) return 2;
  const idx = LEGACY_REDIRECT_PHASES.findIndex((p) => norm.startsWith(p.toLowerCase()));
  return idx;
}

export function buildLegacyRedirectMicroSnapshot(
  progress: LegacyRedirectHeaderProgress | null | undefined,
): MetaBulkMicroSnapshot | null {
  if (!progress?.phase?.trim()) return null;

  const phase = progress.phase.trim();
  const urlTotal = progress.sheetLineCount ?? 0;
  const processedCount = progress.matchedCount ?? 0;
  const batchesTotal = progress.batchesTotal ?? 0;
  const batchesCompleted = progress.batchesCompleted ?? 0;

  const useUrlProgress = urlTotal > 0;
  const completed = useUrlProgress
    ? processedCount
    : batchesTotal > 0
      ? batchesCompleted
      : Math.max(0, Math.floor(progress.completed));
  const total = useUrlProgress
    ? urlTotal
    : batchesTotal > 0
      ? batchesTotal
      : Math.max(0, Math.floor(progress.total));

  let progressPct = progress.progressPct;
  if (progressPct == null && total > 0) {
    progressPct = Math.min(100, (completed / total) * 100);
  }

  const statusParts: string[] = [];
  if (useUrlProgress) {
    statusParts.push(`${processedCount} / ${urlTotal} URLs`);
  } else if (batchesTotal > 0) {
    statusParts.push(`Batch ${batchesCompleted} / ${batchesTotal}`);
  } else if (processedCount > 0) {
    statusParts.push(`${processedCount} URLs`);
  }
  const statusMessage =
    statusParts.length > 0 && phase.toLowerCase() !== statusParts.join(" · ").toLowerCase()
      ? statusParts.join(" · ")
      : phase.toLowerCase() === "match redirects" && statusParts.length > 0
        ? statusParts.join(" · ")
        : undefined;

  return {
    label: phase,
    completed,
    total: total || 1,
    statusMessage,
    progressPct,
  };
}

export function legacyRedirectHeaderProgressFromMatch(
  progress: {
    phase: string;
    completed: number;
    total: number;
    message?: string;
    detail?: string;
    catalogSize?: number;
    batchesCompleted?: number;
    batchesTotal?: number;
    matchedCount?: number;
    redirectCount?: number;
    uploadRowCount?: number;
  },
  sheetLineCount?: number,
  sheetName?: string,
): LegacyRedirectHeaderProgress {
  const phaseLabel =
    progress.phase === "inventory"
      ? "Load site inventory"
      : progress.phase === "match"
        ? "Match redirects"
        : progress.phase === "done"
          ? "Build Rank Math CSV"
          : progress.message ?? progress.phase;

  const urlTotal = sheetLineCount ?? progress.uploadRowCount ?? 0;
  const processedCount = progress.matchedCount ?? progress.completed;

  let progressPct: number | undefined;
  if (urlTotal > 0) {
    progressPct = Math.min(100, (processedCount / urlTotal) * 100);
  } else if (progress.phase === "inventory" && progress.total > 0) {
    progressPct = (progress.completed / progress.total) * 100;
  } else if (progress.phase === "match" && (progress.batchesTotal ?? 0) > 0) {
    progressPct = ((progress.batchesCompleted ?? 0) / (progress.batchesTotal ?? 1)) * 100;
  } else if (progress.phase === "done") {
    progressPct = 100;
  }

  return {
    phase: phaseLabel,
    completed: urlTotal > 0 ? processedCount : progress.completed,
    total: urlTotal > 0 ? urlTotal : progress.total,
    progressPct,
    batchesCompleted: progress.batchesCompleted,
    batchesTotal: progress.batchesTotal,
    catalogSize: progress.catalogSize,
    matchedCount: progress.matchedCount,
    redirectCount: progress.redirectCount,
    sheetLineCount,
    sheetName,
  };
}
