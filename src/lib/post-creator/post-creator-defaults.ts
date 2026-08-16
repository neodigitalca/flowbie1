import type { TaskExecutionPayload } from "@/lib/tasks-types";

export function defaultPostCreatorExecutionPayload(): TaskExecutionPayload {
  return {
    postCount: 1,
    keywordSource: "prompt",
    featuredImage: true,
    sitemapType: "post",
    postDestination: "wordpress",
    scheduleTimesPerMonth: 1,
    scheduleStartDay: 1,
    scheduleStartTime: "09:00",
    scheduleStaggerOptimized: true,
    targetBucket: "posts",
  };
}

export function defaultPostCreatorExecutionPayloadForRecipe(
  recipeKeyword: string,
): TaskExecutionPayload {
  if (recipeKeyword === "monthly-3-posts-editorial") {
    return {
      ...defaultPostCreatorExecutionPayload(),
      postCount: 3,
      scheduleTimesPerMonth: 3,
    };
  }
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
