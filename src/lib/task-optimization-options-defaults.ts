import type { TaskExecutionPayload } from "@/lib/tasks-types";

export type TaskOptimizationOptions = NonNullable<TaskExecutionPayload["optimizationOptions"]>;

const FULL_CONTENT: TaskOptimizationOptions = {
  optimizeTitle: true,
  optimizeMeta: true,
  optimizeExcerpt: true,
  optimizeContent: true,
  optimizeExtraText: false,
  optimizeFeaturedImage: false,
  useAcfKeyword: true,
};

const META_ONLY: TaskOptimizationOptions = {
  optimizeTitle: true,
  optimizeMeta: true,
  optimizeExcerpt: false,
  optimizeContent: false,
  optimizeExtraText: true,
  optimizeFeaturedImage: false,
  useAcfKeyword: true,
};

export function defaultOptimizationOptionsForAction(actionKeyword: string): TaskOptimizationOptions {
  if (actionKeyword === "content-optimizer-meta") return { ...META_ONLY };
  if (actionKeyword === "content-optimizer-full") return { ...FULL_CONTENT };
  return { ...FULL_CONTENT };
}

export function ensureOptimizationOptions(
  payload: TaskExecutionPayload,
  actionKeyword: string,
): TaskExecutionPayload {
  const defaults = defaultOptimizationOptionsForAction(actionKeyword);
  const current = payload.optimizationOptions ?? {};
  return {
    ...payload,
    optimizationOptions: {
      ...defaults,
      ...current,
    },
  };
}

export function inferOptimizerKindFromOptions(
  options: TaskOptimizationOptions,
): "content_optimizer" | "content_optimizer_meta" {
  return options.optimizeContent ? "content_optimizer" : "content_optimizer_meta";
}

export function inferOptimizerKeywordFromOptions(options: TaskOptimizationOptions): string {
  return options.optimizeContent ? "content-optimizer-full" : "content-optimizer-meta";
}
