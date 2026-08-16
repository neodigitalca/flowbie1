import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import type { BulkGeneratorDetailsPanelProps } from "@/components/keyword-research/bulk/BulkGeneratorDetailsPanel";

/** Content Optimizer details — same universal drawer as Entity / CSV / Prompt. */
export function ContentOptimizerDetailsDrawer(props: BulkGeneratorDetailsPanelProps) {
  return (
    <BulkGeneratorDetailsDrawer
      variant="csv"
      postDestination="wordpress"
      wpConfig={null}
      {...props}
    />
  );
}
