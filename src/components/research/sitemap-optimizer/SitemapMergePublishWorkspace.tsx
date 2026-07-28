import { SitemapApproveProgressPanel } from "@/components/research/sitemap-optimizer/SitemapApproveProgressPanel";
import type { ApprovePlanProgress } from "@/hooks/research/use-sitemap-optimizer-approve-plan";

type Props = {
  approveProgress: ApprovePlanProgress | null;
  approving: boolean;
};

export function SitemapMergePublishWorkspace({ approveProgress, approving }: Props) {
  const showApprovePanel =
    (approving || approveProgress) && approveProgress?.phase !== "done";

  if (!showApprovePanel || !approveProgress) {
    return null;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-2">
      <SitemapApproveProgressPanel progress={approveProgress} />
    </div>
  );
}
