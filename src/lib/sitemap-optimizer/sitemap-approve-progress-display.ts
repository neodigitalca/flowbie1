import type { ApprovePlanPhase, ApprovePlanPhaseProgress } from "@/lib/sitemap-optimizer/sitemap-optimizer-approve-plan";

export type SitemapApproveStepId =
  | "redirects"
  | "content_sheet"
  | "trash"
  | "done";

export const SITEMAP_APPROVE_STEPS: { id: SitemapApproveStepId; label: string }[] = [
  { id: "redirects", label: "Export redirects" },
  { id: "content_sheet", label: "Export content sheet" },
  { id: "trash", label: "Trash source posts" },
  { id: "done", label: "Complete" },
];

export type SitemapApproveProgressView = ApprovePlanPhaseProgress;

function stepIndex(phase: ApprovePlanPhase): number {
  if (phase === "done") return SITEMAP_APPROVE_STEPS.length;
  return SITEMAP_APPROVE_STEPS.findIndex((s) => s.id === phase);
}

export function sitemapApproveOverallPct(progress: SitemapApproveProgressView): number {
  const { phase, completed, total } = progress;
  if (phase === "done") return 100;

  const steps = SITEMAP_APPROVE_STEPS.length;
  const segment = 100 / steps;
  const idx = stepIndex(phase);
  if (idx < 0) return 0;

  const base = idx * segment;

  if (phase === "redirects" || phase === "content_sheet") {
    const inner = total > 0 ? Math.min(1, completed / total) : 0.5;
    return completed >= total && total > 0
      ? base + segment
      : Math.max(base + segment * 0.35, base + inner * segment);
  }

  if (phase === "trash") {
    const inner = total > 0 ? Math.min(1, completed / total) : 0;
    return base + inner * segment;
  }

  return base;
}

export function sitemapApprovePhaseIndeterminate(progress: SitemapApproveProgressView): boolean {
  const { phase, completed, total } = progress;
  if (phase === "redirects" || phase === "content_sheet") {
    return total === 0 || (completed === 0 && total > 0);
  }
  return false;
}

export type SitemapApproveStepStatus = "pending" | "active" | "done";

export function sitemapApproveStepStatus(
  stepId: SitemapApproveStepId,
  progress: SitemapApproveProgressView,
): SitemapApproveStepStatus {
  const currentIdx = stepIndex(progress.phase);
  const stepIdx = SITEMAP_APPROVE_STEPS.findIndex((s) => s.id === stepId);
  if (stepIdx < 0) return "pending";
  if (progress.phase === "done") return "done";
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

export function sitemapApproveActiveStepLines(
  stepId: SitemapApproveStepId,
  progress: SitemapApproveProgressView,
): string[] {
  const { detail, completed, total } = progress;

  if (stepId === "redirects" || stepId === "content_sheet") {
    if (detail) return [detail];
    return completed >= total && total > 0 ? ["Done"] : ["Working…"];
  }

  if (stepId === "trash") {
    if (total > 0) {
      return [detail ?? `Moving posts to trash · ${completed} / ${total}`];
    }
    return [detail ?? "No source posts to trash"];
  }

  return ["Working…"];
}

export function sitemapApproveDoneStepLines(
  stepId: SitemapApproveStepId,
  progress: SitemapApproveProgressView,
): string[] {
  if (stepId === "redirects") {
    return progress.completed > 0 ? ["Redirect CSV downloaded"] : ["Skipped"];
  }
  if (stepId === "content_sheet") {
    return progress.phase === "done" || stepIndex(progress.phase) > stepIndex("content_sheet")
      ? ["Content sheet downloaded"]
      : ["Skipped"];
  }
  if (stepId === "trash") {
    return ["Source posts trashed"];
  }
  if (stepId === "done") {
    return ["Plan approved"];
  }
  return ["Done"];
}
