import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import {
  SITEMAP_APPROVE_STEPS,
  sitemapApproveStepStatus,
  type SitemapApproveProgressView,
} from "@/lib/sitemap-optimizer/sitemap-approve-progress-display";

function approveStatusToHarness(
  status: "pending" | "active" | "done",
): BulkHarnessSectionUi["status"] {
  if (status === "active") return "generating";
  if (status === "done") return "done";
  return "waiting";
}

export function buildSitemapApproveHarnessSections(
  progress: SitemapApproveProgressView | null | undefined,
): BulkHarnessSectionUi[] {
  if (!progress) {
    return SITEMAP_APPROVE_STEPS.map((step, sectionIndex) => ({
      sectionIndex,
      title: step.label,
      status: "waiting" as const,
    }));
  }

  return SITEMAP_APPROVE_STEPS.map((step, sectionIndex) => ({
    sectionIndex,
    title: step.label,
    status: approveStatusToHarness(sitemapApproveStepStatus(step.id, progress)),
    markdown: progress.detail?.trim() || undefined,
  }));
}
