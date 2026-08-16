import type { WordPressSite } from "@/components/integrations/types";
import type { WordPressPostingOptions } from "@/lib/bulk-auto-generate";
import { buildWordPressPostingFromSelection } from "@/lib/build-wordpress-bulk-posting";
import type {
  PostCreatorExecutionPayload,
  PostCreatorPostDestination,
  PostCreatorSitemapType,
} from "@/lib/tasks-types";
import { clampTimesPerMonth } from "@/lib/wordpress-scheduler";
import { postCreatorRunStartDate } from "@/lib/post-creator/post-creator-run-start-date";

export { postCreatorRunStartDate };

export type ResolvedPostCreatorSchedule = {
  postCount: number;
  timesPerMonth: number;
  startDay: number;
  startTime: string;
  staggerOptimized: boolean;
  sitemapType: PostCreatorSitemapType;
  postDestination: PostCreatorPostDestination;
  featuredImage: boolean;
};

export function resolvePostCreatorSchedule(
  payload: PostCreatorExecutionPayload,
): ResolvedPostCreatorSchedule {
  const postCount = Math.max(1, Math.min(31, Math.floor(Number(payload.postCount ?? 1) || 1)));
  const timesPerMonth = clampTimesPerMonth(payload.scheduleTimesPerMonth ?? postCount);
  return {
    postCount,
    timesPerMonth,
    startDay: Math.max(1, Math.min(28, Math.floor(Number(payload.scheduleStartDay ?? 1) || 1))),
    startTime: payload.scheduleStartTime?.trim() || "09:00",
    staggerOptimized: payload.scheduleStaggerOptimized !== false,
    sitemapType: payload.sitemapType === "entity" ? "entity" : "post",
    postDestination:
      payload.postDestination === "draft"
        ? "draft"
        : payload.postDestination === "bank"
          ? "bank"
          : "wordpress",
    featuredImage: payload.featuredImage !== false,
  };
}

export function buildPostCreatorWordPressPosting(
  site: WordPressSite,
  rowCount: number,
  schedule: ResolvedPostCreatorSchedule,
): WordPressPostingOptions | undefined {
  const draftOnly = schedule.postDestination === "draft";
  const postDestination =
    schedule.postDestination === "bank" ? "bank" : draftOnly ? "wordpress" : "wordpress";

  const selectedSiteIds = new Set([site.id]);
  const siteConfigs = { [site.id]: { sitemapType: schedule.sitemapType } };

  return buildWordPressPostingFromSelection({
    selectedSiteIds,
    siteConfigs,
    scheduleFrequency: "custom",
    customInterval: schedule.timesPerMonth,
    dayOfWeek: 0,
    startDateOption: "custom",
    customStartDate: postCreatorRunStartDate(schedule.startDay, schedule.startTime),
    startTime: schedule.startTime,
    totalRows: rowCount,
    useCsvPublishDates: false,
    postDestination,
    draftOnly,
  });
}
