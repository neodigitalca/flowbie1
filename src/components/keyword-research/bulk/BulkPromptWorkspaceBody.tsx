import type { CSVRow, WordPressPostDestination } from "@/lib/bulk-auto-generate";
import type { ScheduleOccupancy } from "@/lib/bulk-schedule-gap";
import type { ScheduleFrequency } from "@/lib/wordpress-scheduler";
import { GeneratedBlogIdeasList } from "@/components/keyword-research/bulk/GeneratedBlogIdeasList";
import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";

export type BulkPromptWorkspaceBodyProps = {
  numberOfBlogs: number;
  hasGeneratedChecklist: boolean;
  generatedRows: CSVRow[];
  previewRows: CSVRow[];
  baseDisplayIndices?: number[];
  rowOrder: number[];
  setRowOrder: (value: number[] | ((prev: number[]) => number[])) => void;
  selectedBlogIndices: Set<number>;
  setSelectedBlogIndices: (indices: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  isGeneratingChecklist: boolean;
  isProcessing: boolean;
  publishDateLabelByIndex: Record<number, string>;
  onRowChange: (index: number, patch: Partial<CSVRow>) => void;
  postDestination: WordPressPostDestination;
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: "immediate" | "custom";
  customStartDate: Date;
  startTime: string;
  useCsvPublishDates: boolean;
  useGapScheduling: boolean;
  scheduleOccupancy?: ScheduleOccupancy | null;
  wordpressDraftOnly?: boolean;
};

export function BulkPromptWorkspaceBody({
  hasGeneratedChecklist,
  generatedRows,
  previewRows,
  baseDisplayIndices,
  rowOrder,
  setRowOrder,
  selectedBlogIndices,
  setSelectedBlogIndices,
  isGeneratingChecklist,
  isProcessing,
  publishDateLabelByIndex,
  onRowChange,
  postDestination,
  slotPublishLabels,
  wordpressDraftOnly = false,
}: BulkPromptWorkspaceBodyProps & { slotPublishLabels?: string[] }) {
  const sortable = postDestination !== "local";
  const hasContent = hasGeneratedChecklist && generatedRows.length > 0;

  return (
    <GeneratedBlogIdeasList
      hasGeneratedChecklist={hasGeneratedChecklist}
      slotMode={!hasGeneratedChecklist}
      placeholderCount={BULK_GENERATOR_EMPTY_ROW_COUNT}
      generatedRows={generatedRows}
      selectedBlogIndices={selectedBlogIndices}
      setSelectedBlogIndices={setSelectedBlogIndices}
      isGeneratingChecklist={isGeneratingChecklist}
      isProcessing={isProcessing}
      publishDateLabelByIndex={publishDateLabelByIndex}
      draftOnly={wordpressDraftOnly && postDestination !== "local"}
      onRowChange={onRowChange}
      showPublishDates={sortable && hasContent}
      embedded
      sortable={sortable && hasContent}
      previewRows={previewRows}
      rowOrder={rowOrder}
      setRowOrder={setRowOrder}
      baseDisplayIndices={baseDisplayIndices}
      slotPublishLabels={slotPublishLabels ?? []}
      sortableDisabled={isProcessing || isGeneratingChecklist}
    />
  );
}
