import type {
  BulkProgressSlice,
  MetaPipelineStepUi,
  PipelineStepStatus,
} from "@/components/overview/overview-tab-constants";
import { CONTENT_OPTIMIZER_BULK_PAGE_SIZE } from "@/lib/content-optimizer/content-optimizer-bulk-page-size";

/** WordPress core batch/v1 max sub-requests (matches server bulk-overview-seo.js). */
export const OVERVIEW_WP_API_BATCH_SIZE = 25;

export function overviewWpApiBatchCount(total: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / OVERVIEW_WP_API_BATCH_SIZE);
}

export function overviewUiBatchCount(total: number, batchSize = CONTENT_OPTIMIZER_BULK_PAGE_SIZE): number {
  if (total <= 0) return 0;
  return Math.ceil(total / batchSize);
}

export function rowCountForBatch(
  batchIndex: number,
  batchSize: number,
  total: number,
): number {
  const start = batchIndex * batchSize;
  return Math.min(batchSize, total - start);
}

export function buildBatchPipelineSteps(
  batchCount: number,
  batchSize: number,
  total: number,
  labelForBatch: (batchIndex: number, batchCount: number, rowCount: number) => string,
): MetaPipelineStepUi[] {
  return Array.from({ length: batchCount }, (_, batchIndex) => ({
    id: `batch-${batchIndex}`,
    label: labelForBatch(batchIndex, batchCount, rowCountForBatch(batchIndex, batchSize, total)),
    status: "waiting" as PipelineStepStatus,
  }));
}

export function setBatchStepStatus(
  steps: MetaPipelineStepUi[],
  batchIndex: number,
  status: PipelineStepStatus,
): MetaPipelineStepUi[] {
  return steps.map((step, i) => {
    if (i < batchIndex) {
      return step.status === "done" ? step : { ...step, status: "done" as const };
    }
    if (i === batchIndex) {
      return { ...step, status };
    }
    return step;
  });
}

export function buildKeywordBatchPipelineSteps(
  batchCount: number,
  batchSize: number,
  total: number,
  statusLabel: string,
): MetaPipelineStepUi[] {
  return buildBatchPipelineSteps(batchCount, batchSize, total, (batchIndex, count, rowCount) => {
    const prefix = count > 1 ? `${statusLabel} batch ${batchIndex + 1}/${count}` : statusLabel;
    return `${prefix} (${rowCount} rows)`;
  });
}

export function buildWpUploadBatchPipelineSteps(total: number): MetaPipelineStepUi[] {
  const batchSize = OVERVIEW_WP_API_BATCH_SIZE;
  const batchCount = overviewWpApiBatchCount(total);
  return buildBatchPipelineSteps(batchCount, batchSize, total, (batchIndex, count, rowCount) => {
    const noun = rowCount === 1 ? "item" : "items";
    return `WP batch ${batchIndex + 1}/${count} (${rowCount} ${noun})`;
  });
}

export function wpUploadBatchStepsAfterProgress(
  steps: MetaPipelineStepUi[],
  wpBatch: number,
  wpBatchCount: number,
): MetaPipelineStepUi[] {
  if (wpBatch >= wpBatchCount) {
    return steps.map((s) => ({ ...s, status: "done" as const }));
  }
  return setBatchStepStatus(steps, wpBatch, "running");
}

export function initBulkSliceBatchHarness(
  slice: BulkProgressSlice,
  total: number,
  actionLabel: string,
  batchSize = CONTENT_OPTIMIZER_BULK_PAGE_SIZE,
): BulkProgressSlice {
  const batchCount = overviewUiBatchCount(total, batchSize);
  const pipelineSteps = setBatchStepStatus(
    buildBatchPipelineSteps(batchCount, batchSize, total, (batchIndex, count, rowCount) => {
      const prefix = count > 1 ? `${actionLabel} batch ${batchIndex + 1}/${count}` : actionLabel;
      return `${prefix} (${rowCount} rows)`;
    }),
    0,
    "running",
  );
  return { ...slice, totalRows: batchCount, pipelineSteps };
}

export function advanceBulkSliceBatchProgress(
  slice: BulkProgressSlice,
  completed: number,
  total: number,
  batchSize = CONTENT_OPTIMIZER_BULK_PAGE_SIZE,
): BulkProgressSlice {
  const steps = slice.pipelineSteps;
  if (!steps?.length) {
    return { ...slice, completed };
  }
  const batchCount = steps.length;
  const allDone = completed >= total;
  const doneBatches = allDone ? batchCount : Math.min(batchCount - 1, Math.floor(completed / batchSize));
  const runningBatch = allDone ? -1 : Math.min(batchCount - 1, doneBatches);

  const pipelineSteps = steps.map((step, i) => {
    if (allDone || i < doneBatches) {
      return { ...step, status: "done" as const };
    }
    if (i === runningBatch) {
      return { ...step, status: "running" as const };
    }
    return { ...step, status: "waiting" as const };
  });

  return { ...slice, completed, pipelineSteps };
}

/** @deprecated Use setBatchStepStatus */
export const setKeywordBatchStepStatus = setBatchStepStatus;
