import type { CSVRow } from "@/lib/bulk-auto-generate";
import { SapEntityAdGroupList } from "@/components/keyword-research/bulk/SapEntityAdGroupList";

export type BulkEntityWorkspaceBodyProps = {
  hasGeneratedSapRows: boolean;
  generatedRows: CSVRow[];
  selectedRowIndices: Set<number>;
  setSelectedRowIndices: (indices: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  isGenerating: boolean;
  isProcessing: boolean;
  onRowChange: (index: number, patch: Partial<CSVRow>) => void;
  directionsSiteName?: string;
  /** Placeholder stripes below content rows; 0 shows only real rows (competitor generator). */
  emptyRowPadCount?: number;
  showBusySpinner?: boolean;
};

/** Entity SAP list — AdGroup layout for preload slots and post-Clusters rows. */
export function BulkEntityWorkspaceBody({
  hasGeneratedSapRows: _hasGeneratedSapRows,
  generatedRows,
  selectedRowIndices,
  setSelectedRowIndices,
  isGenerating,
  isProcessing,
  onRowChange,
  directionsSiteName,
  emptyRowPadCount,
  showBusySpinner,
}: BulkEntityWorkspaceBodyProps) {
  return (
    <SapEntityAdGroupList
      generatedRows={generatedRows}
      selectedRowIndices={selectedRowIndices}
      setSelectedRowIndices={setSelectedRowIndices}
      isGenerating={isGenerating}
      isProcessing={isProcessing}
      onRowChange={onRowChange}
      directionsSiteName={directionsSiteName}
      emptyRowPadCount={emptyRowPadCount}
      showBusySpinner={showBusySpinner}
    />
  );
}
