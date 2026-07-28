import type { ScheduleFrequency } from '@/lib/wordpress-scheduler';
import type { WordPressPostDestination } from '@/lib/bulk-auto-generate';

const STORAGE_KEY = 'flowbie_sap_bulk_schedule_v1';

import type { BulkSitemapMode } from "@/lib/bulk/bulk-sitemap-mode";

export type SapBulkSchedulePrefsV1 = {
  v: 1;
  scheduleFrequency: ScheduleFrequency;
  customInterval: number;
  dayOfWeek: number;
  startDateOption: 'immediate' | 'custom';
  customStartDateIso: string;
  startTime: string;
  selectedSiteId: string | null;
  sitemapType: BulkSitemapMode;
  /** When false, ignore CSV `publish_date_gmt` for scheduling. */
  useCsvPublishDates?: boolean;
  /** After generation: WordPress, bank, or hybrid (first UTC month → WP, rest → bank). */
  postDestination?: WordPressPostDestination;
};

export function loadSapBulkSchedulePrefs(): SapBulkSchedulePrefsV1 | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<
      SapBulkSchedulePrefsV1 & {
        /** Legacy; ignored (stagger is always on for times/month). */
        customStaggerOptimized?: boolean;
        /** Legacy; ignored (posting is always on when a site is connected). */
        postToWordPress?: boolean;
      }
    >;
    if (parsed.v !== 1 || !parsed.customStartDateIso || !parsed.startTime) return null;
    if (!['immediately', 'daily', 'weekly', 'monthly', 'custom', 'everyNDays'].includes(parsed.scheduleFrequency ?? '')) return null;
    if (typeof parsed.customInterval !== 'number' || parsed.customInterval < 1) return null;
    const d = new Date(parsed.customStartDateIso);
    if (Number.isNaN(d.getTime())) return null;
    const pd = parsed.postDestination;
    const postDestination: WordPressPostDestination | undefined =
      pd === 'wordpress' || pd === 'bank' || pd === 'hybrid' || pd === 'local' ? pd : undefined;
    return {
      v: 1,
      scheduleFrequency: parsed.scheduleFrequency!,
      customInterval: parsed.customInterval,
      dayOfWeek: typeof parsed.dayOfWeek === 'number' ? parsed.dayOfWeek : 1,
      startDateOption: parsed.startDateOption === 'immediate' ? 'immediate' : 'custom',
      customStartDateIso: parsed.customStartDateIso,
      startTime: parsed.startTime,
      selectedSiteId: typeof parsed.selectedSiteId === 'string' ? parsed.selectedSiteId : null,
      sitemapType:
        parsed.sitemapType === "entity"
          ? "entity"
          : parsed.sitemapType === "custom"
            ? "custom"
            : "post",
      useCsvPublishDates:
        typeof parsed.useCsvPublishDates === 'boolean' ? parsed.useCsvPublishDates : undefined,
      postDestination,
    };
  } catch {
    return null;
  }
}

export function saveSapBulkSchedulePrefs(prefs: SapBulkSchedulePrefsV1): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}
