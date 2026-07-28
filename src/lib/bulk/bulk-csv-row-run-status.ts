import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";

export type BulkCsvRowRunStatus = "waiting" | "generating" | "done" | "error";

export function bulkCsvRowRunStatus(args: {
  rowIndex: number;
  currentRow: number;
  isProcessing: boolean;
  filesByRow: Map<number, BulkGeneratedFile[]>;
  failedRowIndices?: ReadonlySet<number>;
}): BulkCsvRowRunStatus {
  const { rowIndex, currentRow, isProcessing, filesByRow, failedRowIndices } = args;
  if (failedRowIndices?.has(rowIndex)) return "error";
  const files = filesByRow.get(rowIndex);
  const hasCompleted = files?.some((f) => f.status === "completed") ?? false;
  if (hasCompleted) return "done";
  if (isProcessing && rowIndex === currentRow) return "generating";
  if (rowIndex < currentRow) return "done";
  return "waiting";
}

export function countBulkCsvRowsDone(args: {
  totalRows: number;
  currentRow: number;
  isProcessing: boolean;
  filesByRow: Map<number, BulkGeneratedFile[]>;
  failedRowIndices?: ReadonlySet<number>;
}): number {
  let done = 0;
  for (let i = 0; i < args.totalRows; i++) {
    if (bulkCsvRowRunStatus({ ...args, rowIndex: i }) === "done") done += 1;
  }
  return done;
}
