import type { EntityPageCreatorExecutionPayload } from "@/lib/tasks-types";
import { DEFAULT_ENTITY_PAGE_CREATOR_ENTITY_TYPE_FOCUS } from "@/lib/entity-page-creator/entity-page-creator-cluster-context";

export const DEFAULT_ENTITY_AD_GROUP_COUNT = 3;
export const DEFAULT_ENTITY_ADS_PER_GROUP = 5;
export const DEFAULT_ENTITY_PAGE_COUNT = 15;

export function defaultEntityPageCreatorExecutionPayload(): EntityPageCreatorExecutionPayload {
  return {
    locationSource: "grid",
    gridInputSource: "workflow",
    entityAdGroupCount: DEFAULT_ENTITY_AD_GROUP_COUNT,
    entityAdsPerGroup: DEFAULT_ENTITY_ADS_PER_GROUP,
    entityPageCount: DEFAULT_ENTITY_PAGE_COUNT,
    focusKeyword: "",
    entityTypeFocus: [...DEFAULT_ENTITY_PAGE_CREATOR_ENTITY_TYPE_FOCUS],
    sitemapType: "entity",
    featuredImage: false,
    postDestination: "wordpress",
    postCount: DEFAULT_ENTITY_PAGE_COUNT,
    scheduleFrequency: "custom",
    scheduleCustomInterval: 15,
    scheduleDayOfWeek: 1,
    scheduleStartDateOption: "immediate",
    scheduleTimesPerMonth: 15,
    scheduleStartDay: 1,
    scheduleStartTime: "09:00",
    scheduleStaggerOptimized: true,
    targetBucket: "sap",
    saveLocalArchive: true,
  };
}

export function ensureEntityPageCreatorPayload(
  payload?: EntityPageCreatorExecutionPayload | null,
): EntityPageCreatorExecutionPayload {
  const base = defaultEntityPageCreatorExecutionPayload();
  const merged = { ...base, ...(payload ?? {}) };
  if (merged.locationSource !== "grid") {
    merged.locationSource = "grid";
  }
  merged.gridInputSource = "workflow";
  merged.gridCsvBase64 = undefined;
  merged.gridCsvUrl = undefined;
  const groups = Math.max(1, Math.floor(Number(merged.entityAdGroupCount) || DEFAULT_ENTITY_AD_GROUP_COUNT));
  const ads = Math.max(1, Math.floor(Number(merged.entityAdsPerGroup) || DEFAULT_ENTITY_ADS_PER_GROUP));
  const total = groups * ads;
  return {
    ...merged,
    entityAdGroupCount: groups,
    entityAdsPerGroup: ads,
    entityPageCount: total,
    postCount: total,
    scheduleTimesPerMonth: merged.scheduleTimesPerMonth ?? total,
    scheduleCustomInterval: merged.scheduleCustomInterval ?? total,
    sitemapType: "entity",
    targetBucket: "sap",
  };
}
