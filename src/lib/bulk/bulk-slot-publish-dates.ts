import type { CSVRow } from "@/lib/bulk-auto-generate";
import { gapScheduleStartDate } from "@/lib/bulk-schedule-gap";
import type { ScheduleOccupancy } from "@/lib/bulk-schedule-gap";
import { formatOverviewRowDateLabel } from "@/lib/overview/overview-tab-display";
import {
  formatWordPressDate,
  resolveBulkWordPressPublishDate,
  resolveTimesPerMonthAnchorStart,
  type ScheduleFrequency,
} from "@/lib/wordpress-scheduler";

export type ComputeBulkSlotPublishDatesInput = {
  previewRows: CSVRow[];
  rowOrder: number[];
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: "immediate" | "custom";
  customStartDate: Date;
  startTime: string;
  useCsvPublishDates: boolean;
  useGapScheduling: boolean;
  scheduleOccupancy?: ScheduleOccupancy | null;
};

export function formatBulkPublishDateLabel(isoGmt: string): string {
  return formatOverviewRowDateLabel(isoGmt);
}

/** ISO GMT publish instants per processing slot (same order as bulk run). */
export function computeBulkSlotPublishIsoLabels(
  input: ComputeBulkSlotPublishDatesInput,
): string[] {
  const n = input.previewRows.length;
  if (n === 0) return [];

  const startDate =
    input.scheduleFrequency === "custom"
      ? resolveTimesPerMonthAnchorStart(
          input.startDateOption,
          input.customStartDate,
          input.startTime,
        )
      : input.startDateOption === "immediate"
        ? gapScheduleStartDate(input.startTime)
        : input.customStartDate;

  const useGap =
    input.scheduleFrequency !== "custom" && input.useGapScheduling;

  const order =
    input.rowOrder.length === n
      ? input.rowOrder
      : Array.from({ length: n }, (_, i) => i);

  const priorDates: Date[] = [];
  const labels: string[] = [];

  for (let slotIdx = 0; slotIdx < n; slotIdx++) {
    const srcIdx = order[slotIdx] ?? slotIdx;
    const row = input.previewRows[srcIdx];
    const schedule = {
      frequency: input.scheduleFrequency,
      customInterval:
        input.scheduleFrequency === "custom" || input.scheduleFrequency === "everyNDays"
          ? input.customInterval
          : undefined,
      customStaggerOptimized: input.scheduleFrequency === "custom" ? true : undefined,
      dayOfWeek: input.scheduleFrequency === "weekly" ? input.dayOfWeek : undefined,
      startDate,
      startTime: input.startTime,
      totalRows: n,
      useGapScheduling: useGap,
      scheduleOccupancy: useGap ? input.scheduleOccupancy ?? undefined : undefined,
      priorInBatchDates: [...priorDates],
    };
    const { date } = resolveBulkWordPressPublishDate({
      rowPublishDateGmt: row?.publish_date_gmt,
      rowIndex: slotIdx,
      schedule,
      useCsvPublishDates: input.useCsvPublishDates,
    });
    priorDates.push(date);
    labels.push(formatWordPressDate(date));
  }

  return labels;
}

/** Human-readable publish labels keyed by generated-row index. Only from schedule / CSV. Never invents today. */
export function computePublishDateLabelsByGeneratedIndex(
  generatedRowCount: number,
  previewRows: CSVRow[],
  rowDisplayIndices: number[] | undefined,
  rowOrder: number[],
  scheduleInput: Omit<ComputeBulkSlotPublishDatesInput, "previewRows" | "rowOrder">,
): Record<number, string> {
  const out: Record<number, string> = {};

  if (generatedRowCount === 0) return out;

  const n = previewRows.length;
  if (n === 0) return out;

  const isoBySlot = computeBulkSlotPublishIsoLabels({
    ...scheduleInput,
    previewRows,
    rowOrder,
  });

  const displayIndices = rowDisplayIndices ?? Array.from({ length: n }, (_, i) => i);
  const order =
    rowOrder.length === n ? rowOrder : Array.from({ length: n }, (_, i) => i);

  for (let slotIdx = 0; slotIdx < n; slotIdx++) {
    const previewIdx = order[slotIdx] ?? slotIdx;
    const generatedIdx = displayIndices[previewIdx];
    if (generatedIdx === undefined) continue;
    const iso = isoBySlot[slotIdx];
    if (!iso) continue;
    out[generatedIdx] = formatBulkPublishDateLabel(iso);
  }

  return out;
}
