import { useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ScheduleOccupancy } from '@/lib/bulk-schedule-gap';
import { gapScheduleStartDate } from '@/lib/bulk-schedule-gap';
import {
  resolveBulkWordPressPublishDate,
  resolveHybridEffectiveDestination,
  type ScheduleFrequency,
} from '@/lib/wordpress-scheduler';
import { getStoredSites, type WordPressSite } from '@/components/IntegrationsTab';
import type { ConnectedSiteSummary } from '@/components/integrations/types';
import { cn } from '@/lib/utils';
import {
  BULK_POST_DESTINATION_CHOICES,
  type CSVRow,
  type WordPressPostDestination,
} from '@/lib/bulk-auto-generate';
import { WordPressScheduleFields } from './WordPressScheduleFields';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { BulkSitemapMode } from '@/lib/bulk/bulk-sitemap-mode';

/** Flat cells: stronger fill, no stroke - reads clearly on dark UI */
const BULK_FIELD_TRIGGER =
  'h-9 w-full min-w-0 border-0 bg-muted/55 text-foreground text-base font-medium shadow-none ring-0 outline-none focus:ring-2 focus:ring-primary/45 focus:ring-offset-0 [&>span]:text-foreground';

interface SiteConfig {
  sitemapType: BulkSitemapMode;
}

interface WordPressPostingConfigProps {
  selectedWordPressSites: Set<string>;
  setSelectedWordPressSites: (value: Set<string>) => void;
  siteConfigs: Record<string, SiteConfig>;
  setSiteConfigs: (
    value: Record<string, SiteConfig> | ((prev: Record<string, SiteConfig>) => Record<string, SiteConfig>)
  ) => void;
  scheduleFrequency: ScheduleFrequency;
  setScheduleFrequency: (value: ScheduleFrequency) => void;
  customInterval: number;
  setCustomInterval: (value: number) => void;
  dayOfWeek: number;
  setDayOfWeek: (value: number) => void;
  startDateOption: 'immediate' | 'custom';
  setStartDateOption: (value: 'immediate' | 'custom') => void;
  customStartDate: Date;
  setCustomStartDate: (value: Date) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  /** When true, non-empty `publish_date_gmt` cells override frequency schedule for that row. */
  useCsvPublishDates: boolean;
  setUseCsvPublishDates: (value: boolean) => void;
  wordpressDraftOnly: boolean;
  setWordpressDraftOnly: (value: boolean) => void;
  /** Rows that will be processed (effective batch). */
  previewRows: CSVRow[];
  rowOrder: number[];
  isDisabled?: boolean;
  connectedSite?: ConnectedSiteSummary | null;
  /** SAP generator: prefer entity sitemap when no saved config. */
  sapMode?: boolean;
  /** GBP Post: schedule grid only (hide WordPress destination, sitemap, CSV overrides). */
  gbpMode?: boolean;
  postDestination: WordPressPostDestination;
  setPostDestination: (value: WordPressPostDestination) => void;
  /** Which export radios to show (default: wordpress, bank, hybrid, local). */
  postDestinationChoices?: WordPressPostDestination[];
  /** Post inventory occupancy for Next available slot (gap scheduling). */
  scheduleOccupancy?: ScheduleOccupancy | null;
  scheduleOccupancyLoading?: boolean;
  /** Blog import details: destination is in the workspace header toolbar. */
  hideDestinationRadios?: boolean;
  /** Workspace chrome: schedule lives in title-row menu, not details drawer. */
  hideScheduleFields?: boolean;
  /** CSV workspace: sitemap lives in title-row menu, not details drawer. */
  hideSitemapField?: boolean;
}

const POST_DESTINATION_LABELS: Record<WordPressPostDestination, string> = {
  wordpress: 'Post to WordPress',
  bank: 'Bank posts',
  hybrid: 'Hybrid (first month → WP)',
  local: 'Local only (files)',
};

export function WordPressPostingConfig({
  selectedWordPressSites,
  setSelectedWordPressSites,
  siteConfigs,
  setSiteConfigs,
  scheduleFrequency,
  setScheduleFrequency,
  customInterval,
  setCustomInterval,
  dayOfWeek,
  setDayOfWeek,
  startDateOption,
  setStartDateOption,
  customStartDate,
  setCustomStartDate,
  startTime,
  setStartTime,
  useCsvPublishDates,
  setUseCsvPublishDates,
  wordpressDraftOnly,
  setWordpressDraftOnly,
  previewRows,
  rowOrder,
  isDisabled = false,
  connectedSite,
  sapMode = false,
  gbpMode = false,
  postDestination,
  setPostDestination,
  postDestinationChoices = BULK_POST_DESTINATION_CHOICES,
  scheduleOccupancy = null,
  scheduleOccupancyLoading = false,
  hideDestinationRadios = false,
  hideScheduleFields = false,
  hideSitemapField = false,
}: WordPressPostingConfigProps) {
  const sites = getStoredSites();
  const isLocalExport = postDestination === 'local';
  const showRemotePostingFields = !gbpMode && !isLocalExport;

  useEffect(() => {
    if (!postDestinationChoices.includes(postDestination)) {
      setPostDestination(postDestinationChoices[0] ?? 'wordpress');
    }
  }, [postDestination, postDestinationChoices, setPostDestination]);

  const getTargetSite = (): WordPressSite | null => {
    if (!connectedSite || sites.length === 0) return null;
    const normalize = (url: string) =>
      url.trim().toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');
    return (
      sites.find((s) => normalize(s.siteUrl) === normalize(connectedSite.siteUrl)) ?? null
    );
  };

  const targetSite = getTargetSite();

  useEffect(() => {
    if (!targetSite || isDisabled) return;
    setSelectedWordPressSites((prev) => {
      if (prev.has(targetSite.id)) return prev;
      return new Set([targetSite.id]);
    });
    setSiteConfigs((prev) => {
      if (prev[targetSite.id]) return prev;
      return {
        ...prev,
        [targetSite.id]: {
          sitemapType: sapMode && targetSite.entitySitemapUrl ? 'entity' : 'post',
        },
      };
    });
  }, [targetSite, sapMode, isDisabled, setSelectedWordPressSites, setSiteConfigs]);

  const useGapScheduling =
    startDateOption === 'immediate' &&
    !gbpMode &&
    postDestination !== 'local' &&
    scheduleFrequency !== 'immediately' &&
    Boolean(scheduleOccupancy);

  const hybridSlotCounts = useMemo(() => {
    const n = previewRows.length;
    if (n === 0) return { wordpress: 0, bank: 0 };
    const startDate =
      startDateOption === 'immediate' ? gapScheduleStartDate(startTime) : customStartDate;
    const order =
      rowOrder.length === n ? rowOrder : Array.from({ length: n }, (_, i) => i);
    const priorDates: Date[] = [];
    let d0 = new Date();
    for (let slotIdx = 0; slotIdx < n; slotIdx++) {
      const srcIdx = order[slotIdx] ?? slotIdx;
      const row = previewRows[srcIdx];
      const schedule = {
        frequency: scheduleFrequency,
        customInterval:
          scheduleFrequency === 'custom' || scheduleFrequency === 'everyNDays' ? customInterval : undefined,
        customStaggerOptimized: scheduleFrequency === 'custom' ? true : undefined,
        dayOfWeek: scheduleFrequency === 'weekly' ? dayOfWeek : undefined,
        startDate,
        startTime,
        totalRows: n,
        useGapScheduling,
        scheduleOccupancy: scheduleOccupancy ?? undefined,
        priorInBatchDates: [...priorDates],
      };
      const { date } = resolveBulkWordPressPublishDate({
        rowPublishDateGmt: row?.publish_date_gmt,
        rowIndex: slotIdx,
        schedule,
        useCsvPublishDates,
      });
      if (slotIdx === 0) d0 = date;
      priorDates.push(date);
    }
    const anchor = { year: d0.getUTCFullYear(), month: d0.getUTCMonth() };
    let wordpress = 0;
    let bank = 0;
    for (let slotIdx = 0; slotIdx < n; slotIdx++) {
      const eff = resolveHybridEffectiveDestination('hybrid', priorDates[slotIdx]!, anchor);
      if (eff === 'wordpress') wordpress += 1;
      else bank += 1;
    }
    return { wordpress, bank };
  }, [
    previewRows,
    rowOrder,
    useCsvPublishDates,
    scheduleFrequency,
    customInterval,
    dayOfWeek,
    startDateOption,
    startTime,
    customStartDate,
    useGapScheduling,
    scheduleOccupancy,
  ]);

  return (
    <div className={cn('space-y-1.5', sapMode ? 'mt-1' : 'mt-2')}>
      {targetSite && (
        <div className="flex flex-col gap-1 rounded-md bg-muted/20 p-1.5">
          {(() => {
            const site = targetSite;
            const config = siteConfigs[site.id] || {
              sitemapType: 'post' as const,
            };

            return (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {!gbpMode && !hideDestinationRadios ? (
                <div className="flex flex-col gap-2 rounded-md bg-muted/15 p-2 sm:col-span-2">
                  <span className="text-base font-medium text-foreground">Export destination</span>
                  <RadioGroup
                    value={postDestination}
                    onValueChange={(v) => setPostDestination(v as WordPressPostDestination)}
                    disabled={isDisabled}
                    className="flex flex-wrap gap-4"
                  >
                    {postDestinationChoices.map((choice) => (
                      <div key={choice} className="flex items-center gap-2">
                        <RadioGroupItem value={choice} id={`bulk-pd-${choice}`} />
                        <Label
                          htmlFor={`bulk-pd-${choice}`}
                          className="cursor-pointer text-base font-normal"
                        >
                          {POST_DESTINATION_LABELS[choice]}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {postDestination === 'bank' ? (
                    <p className="text-base text-muted-foreground">
                      Rows go to your Supabase Post Bank first. Publish to WordPress from Properties, Bank tab.
                    </p>
                  ) : null}
                  {postDestination === 'hybrid' ? (
                    <p className="text-base text-muted-foreground">
                      Rows in the same UTC calendar month as the first scheduled slot are created as future WordPress
                      posts. Later months are saved to the Supabase content bank with the same scheduled dates (publish
                      from Properties when ready). No automatic cron—bank rows stay queued until you publish.
                    </p>
                  ) : null}
                  {postDestination === 'local' ? (
                    <p className="text-base text-muted-foreground">
                      Full harness and SEO pipeline run locally. Download JSON, blueprint, and post-body CSV from the
                      files panel — nothing is sent to WordPress or the content bank.
                    </p>
                  ) : null}
                </div>
                ) : null}

                {showRemotePostingFields && !hideSitemapField ? (
                <>
                <div className="min-w-0">
                  <Select
                    value={config.sitemapType}
                    onValueChange={(value: 'post' | 'entity') => {
                      setSiteConfigs((prev) => ({
                        ...prev,
                        [site.id]: {
                          ...prev[site.id],
                          sitemapType: value,
                        },
                      }));
                    }}
                    disabled={isDisabled}
                  >
                    <SelectTrigger className={BULK_FIELD_TRIGGER} aria-label="Sitemap type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Post (post-sitemap.xml)</SelectItem>
                      <SelectItem value="entity" disabled={!site.entitySitemapUrl}>
                        Entity (
                        {site.entitySitemapUrl ? site.entitySitemapUrl.split('/').pop() : 'Not configured'})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!hideScheduleFields ? (
                  <WordPressScheduleFields
                    scheduleFrequency={scheduleFrequency}
                    setScheduleFrequency={setScheduleFrequency}
                    customInterval={customInterval}
                    setCustomInterval={setCustomInterval}
                    dayOfWeek={dayOfWeek}
                    setDayOfWeek={setDayOfWeek}
                    startDateOption={startDateOption}
                    setStartDateOption={setStartDateOption}
                    customStartDate={customStartDate}
                    setCustomStartDate={setCustomStartDate}
                    startTime={startTime}
                    setStartTime={setStartTime}
                    useCsvPublishDates={useCsvPublishDates}
                    setUseCsvPublishDates={setUseCsvPublishDates}
                    wordpressDraftOnly={wordpressDraftOnly}
                    setWordpressDraftOnly={setWordpressDraftOnly}
                    isDisabled={isDisabled}
                    gbpMode={gbpMode}
                    useGapScheduling={useGapScheduling}
                    scheduleOccupancyLoading={scheduleOccupancyLoading}
                  />
                ) : null}
                </>
                ) : null}
              </div>
            );
          })()}

          {!gbpMode && postDestination === 'hybrid' && previewRows.length > 0 ? (
            <p className="text-base text-muted-foreground">
              This batch preview: {hybridSlotCounts.wordpress} row(s) → WordPress, {hybridSlotCounts.bank} row(s) →
              content bank (by UTC month of each scheduled date vs. slot 0).
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
