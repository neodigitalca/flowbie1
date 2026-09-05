import type { TaskExecutionPayload } from "@/lib/tasks-types";

export function defaultPostCreatorExecutionPayload(): TaskExecutionPayload {
  return {
    postCount: 1,
    keywordSource: "prompt",
    featuredImage: true,
    sitemapType: "post",
    postDestination: "wordpress",
    scheduleFrequency: "custom",
    scheduleCustomInterval: 1,
    scheduleDayOfWeek: 0,
    scheduleStartDateOption: "custom",
    scheduleTimesPerMonth: 1,
    scheduleStartDay: 1,
    scheduleStartTime: "09:00",
    scheduleStaggerOptimized: true,
    targetBucket: "posts",
  };
}

export function defaultPostCreatorExecutionPayloadForRecipe(
  _recipeKeyword: string,
): TaskExecutionPayload {
  return defaultPostCreatorExecutionPayload();
}

export function ensurePostCreatorPayload(
  payload?: TaskExecutionPayload | null,
): TaskExecutionPayload {
  return {
    ...defaultPostCreatorExecutionPayload(),
    ...(payload ?? {}),
    targetBucket: "posts",
    sitemapType: "post",
  };
}
