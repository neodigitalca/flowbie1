import type { WordPressSite } from "@/components/integrations/types";
import type { WordPressPostingOptions } from "@/lib/bulk-auto-generate";
import { buildWordPressPostingFromSelection } from "@/lib/build-wordpress-bulk-posting";
import type { EntityPageCreatorExecutionPayload } from "@/lib/tasks-types";
import {
  postCreatorRunStartDate,
  resolvePostCreatorSchedule,
  type ResolvedPostCreatorSchedule,
} from "@/lib/post-creator/post-creator-schedule";
import { ensureEntityPageCreatorPayload } from "@/lib/entity-page-creator/entity-page-creator-defaults";

export function entityPageCreatorPayloadToPostCreatorPayload(
  payload: EntityPageCreatorExecutionPayload,
): EntityPageCreatorExecutionPayload {
  const normalized = ensureEntityPageCreatorPayload(payload);
  return {
    ...normalized,
    postCount: normalized.entityPageCount,
    sitemapType: "entity",
    featuredImage: false,
    targetBucket: "sap",
  };
}

export function resolveEntityPageCreatorSchedule(
  payload: EntityPageCreatorExecutionPayload,
): ResolvedPostCreatorSchedule {
  return resolvePostCreatorSchedule(entityPageCreatorPayloadToPostCreatorPayload(payload));
}

export function buildEntityPageCreatorWordPressPosting(
  site: WordPressSite,
  rowCount: number,
  payload: EntityPageCreatorExecutionPayload,
): WordPressPostingOptions | undefined {
  const normalized = entityPageCreatorPayloadToPostCreatorPayload(payload);
  const schedule = resolveEntityPageCreatorSchedule(normalized);
  const draftOnly =
    schedule.postDestination === "draft" || normalized.scheduleDraftOnly === true;

  const selectedSiteIds = new Set([site.id]);
  const siteConfigs = { [site.id]: { sitemapType: "entity" as const } };

  const scheduleFrequency = normalized.scheduleFrequency ?? "custom";
  const customInterval =
    normalized.scheduleCustomInterval ??
    (scheduleFrequency === "custom" ? schedule.timesPerMonth : 1);
  const dayOfWeek = normalized.scheduleDayOfWeek ?? 1;
  const startDateOption = normalized.scheduleStartDateOption ?? "immediate";
  const startTime = schedule.startTime;
  const customStartDate = normalized.scheduleCustomStartDate
    ? new Date(`${normalized.scheduleCustomStartDate.slice(0, 10)}T12:00:00`)
    : postCreatorRunStartDate(schedule.startDay, startTime);

  return buildWordPressPostingFromSelection({
    selectedSiteIds,
    siteConfigs,
    scheduleFrequency,
    customInterval,
    dayOfWeek,
    startDateOption,
    customStartDate,
    startTime,
    totalRows: rowCount,
    postDestination: "wordpress",
    draftOnly,
    publishDays: normalized.schedulePublishDays,
  });
}

export function entityPageCreatorPayloadFromContract(
  contract: Record<string, unknown>,
): EntityPageCreatorExecutionPayload {
  return ensureEntityPageCreatorPayload(contract as EntityPageCreatorExecutionPayload);
}
