import type { WordPressPostingOptions, WordPressPostDestination } from '@/lib/bulk-auto-generate';
import type { CSVRow } from '@/lib/bulk-auto-generate';
import { applyRowOrder, buildBulkBaseRows } from '@/lib/bulk-processing-order';
import type { BuildBulkBaseRowsFailureReason } from '@/lib/bulk-processing-order';
import { loadApiKey } from '@/lib/api';
import { notify } from '@/lib/app-notifications';
import { NOTIFY_API_KEYS_ARE_REQUIRED, NOTIFY_LOCAL_EXPORT_GENERATING_FILES_ONLY_NO_WO, NOTIFY_SELECT_A_WORDPRESS_SITE_AND_SITEMAP_IN_T, notifyHybridRunFirstUtcCalendarMonthWord, notifyPostingToXWordpressSiteSNames, notifySavingXSiteBankQueueNames } from "@/lib/notify-messages";
import type { ScheduleOccupancy } from '@/lib/bulk-schedule-gap';
import { buildWordPressPostingFromSelection, precomputeGapDatesBySlot, resolveDefaultWordPressSiteSelection } from '@/lib/build-wordpress-bulk-posting';
import type { ScheduleFrequency } from '@/lib/wordpress-scheduler';
import type { BulkSitemapMode } from '@/lib/bulk/bulk-sitemap-mode';

interface SiteConfig {
  sitemapType: BulkSitemapMode;
}

interface UseBulkProcessingProps {
  inputMode: 'csv' | 'prompt';
  rows: CSVRow[];
  generatedRows: CSVRow[];
  selectedBlogIndices: Set<number>;
  /** Permutation: slot i processes baseRows[rowOrder[i]]. Length must match base row count. */
  rowOrder: number[];
  selectedWordPressSites: Set<string>;
  siteConfigs: Record<string, SiteConfig>;
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: 'immediate' | 'custom';
  customStartDate: Date;
  startTime: string;
  useCsvPublishDates: boolean;
  wordpressDraftOnly?: boolean;
  apiKey?: string;
  openRouterApiKey?: string;
  selectedModel?: string;
  bulkPostDestination: WordPressPostDestination;
  scheduleOccupancy?: ScheduleOccupancy | null;
  useGapScheduling?: boolean;
  refreshScheduleOccupancy?: () => Promise<ScheduleOccupancy | null>;
  /** Blog import: requires DataForSEO for keyword research; OpenRouter still parses the draft file. */
  skipDataForSeoApiKey?: boolean;
  processAllRows: (
    rows: CSVRow[],
    wordPressPosting?: WordPressPostingOptions,
    rowDisplayIndices?: number[]
  ) => Promise<void>;
  setIsProcessing: (value: boolean) => void;
  setCurrentRow: (value: number) => void;
}

const FAILURE_MESSAGES: Record<BuildBulkBaseRowsFailureReason, string> = {
  csv_empty: 'Please load a CSV file first',
  prompt_empty: 'Please generate blog ideas from your prompt first',
  selection_empty: 'No valid rows selected',
};

export function useBulkProcessing({
  inputMode,
  rows,
  generatedRows,
  selectedBlogIndices,
  rowOrder,
  selectedWordPressSites,
  siteConfigs,
  scheduleFrequency,
  customInterval,
  dayOfWeek,
  startDateOption,
  customStartDate,
  startTime,
  useCsvPublishDates,
  wordpressDraftOnly = false,
  apiKey,
  openRouterApiKey,
  selectedModel,
  bulkPostDestination,
  scheduleOccupancy = null,
  useGapScheduling = false,
  refreshScheduleOccupancy,
  skipDataForSeoApiKey = false,
  processAllRows,
  setIsProcessing,
  setCurrentRow,
}: UseBulkProcessingProps) {
  const handleStartProcessing = async (promptRowsOverride?: CSVRow[]) => {
    const effectiveGeneratedRows = promptRowsOverride ?? generatedRows;
    const built = buildBulkBaseRows(inputMode, rows, effectiveGeneratedRows, selectedBlogIndices);
    if (!built.ok) {
      notify.error(FAILURE_MESSAGES[built.reason]);
      return;
    }
    if (built.infoMessage) {
      notify.info(built.infoMessage);
    }

    const { orderedRows, orderedDisplayIndices } = applyRowOrder(
      built.baseRows,
      built.baseDisplayIndices,
      rowOrder
    );

    const effectiveOpenRouterKey = openRouterApiKey?.trim() || loadApiKey()?.trim() || "";
    if (!effectiveOpenRouterKey) {
      notify.error(NOTIFY_API_KEYS_ARE_REQUIRED);
      return;
    }
    if (!skipDataForSeoApiKey && !apiKey?.trim()) {
      notify.error(NOTIFY_API_KEYS_ARE_REQUIRED);
      return;
    }

    setIsProcessing(true);
    setCurrentRow(0);

    let occupancyForRun = scheduleOccupancy;
    if (useGapScheduling && refreshScheduleOccupancy) {
      occupancyForRun = (await refreshScheduleOccupancy()) ?? occupancyForRun;
    }

    const defaultSelection =
      selectedWordPressSites.size === 0 ? resolveDefaultWordPressSiteSelection() : null;
    const effectiveSiteIds = defaultSelection?.selectedSiteIds ?? selectedWordPressSites;
    const effectiveSiteConfigs = defaultSelection?.siteConfigs ?? siteConfigs;

    const wordPressPosting = buildWordPressPostingFromSelection({
      selectedSiteIds: effectiveSiteIds,
      siteConfigs: effectiveSiteConfigs,
      scheduleFrequency,
      customInterval,
      dayOfWeek,
      startDateOption,
      customStartDate,
      startTime,
      totalRows: orderedRows.length,
      useCsvPublishDates: false,
      postDestination: bulkPostDestination,
      scheduleOccupancy: occupancyForRun,
      useGapScheduling: useGapScheduling && Boolean(occupancyForRun),
      draftOnly: wordpressDraftOnly,
    });

    let postingForRun = wordPressPosting;
    if (postingForRun?.useGapScheduling && postingForRun.scheduleOccupancy) {
      const gapDates = precomputeGapDatesBySlot(orderedRows, postingForRun);
      if (gapDates) {
        postingForRun = { ...postingForRun, gapDatesBySlot: gapDates };
      }
    }

    if (bulkPostDestination === 'local') {
      notify.info(NOTIFY_LOCAL_EXPORT_GENERATING_FILES_ONLY_NO_WO);
      await processAllRows(orderedRows, undefined, orderedDisplayIndices);
      return;
    }

    if (!wordPressPosting?.enabled) {
      setIsProcessing(false);
      notify.error(NOTIFY_SELECT_A_WORDPRESS_SITE_AND_SITEMAP_IN_T);
      return;
    }

    const names = (postingForRun?.sites ?? []).map((x) => x.site.name).join(", ");
    if (bulkPostDestination === 'bank') {
      notify.info(
        notifySavingXSiteBankQueueNames(postingForRun?.sites?.length ?? 0, names || undefined)
      );
    } else if (bulkPostDestination === 'hybrid') {
      notify.info(
        notifyHybridRunFirstUtcCalendarMonthWord(postingForRun?.sites?.length ?? 0, names || undefined)
      );
    } else {
      notify.info(
        notifyPostingToXWordpressSiteSNames(postingForRun?.sites?.length ?? 0, names || undefined)
      );
    }

    await processAllRows(orderedRows, postingForRun, orderedDisplayIndices);
  };

  return {
    handleStartProcessing,
  };
}
