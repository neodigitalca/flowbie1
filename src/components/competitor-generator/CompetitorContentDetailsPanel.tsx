import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import type { CompetitorGenerationProgress } from "@/components/competitor-generation/types";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { buildCompetitorBulkGeneratorDetailsProps } from "@/lib/competitor/competitor-bulk-details-bindings";

export type CompetitorContentDetailsPanelProps = {
  workspaceBusy: boolean;
  progress: CompetitorGenerationProgress | null;
  displayRows: CSVRow[];
  keyword: string;
};

export function CompetitorContentDetailsPanel({
  workspaceBusy,
  progress,
  displayRows,
  keyword,
}: CompetitorContentDetailsPanelProps) {
  const props = buildCompetitorBulkGeneratorDetailsProps({
    workspaceBusy,
    progress,
    displayRows,
    keyword,
  });

  return (
    <BulkGeneratorDetailsDrawer
      variant="csv"
      postDestination="local"
      wpConfig={null}
      {...props}
    />
  );
}
