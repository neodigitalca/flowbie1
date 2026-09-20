import pLimit from "p-limit";

/** Max in-flight AI title/meta OpenRouter streams. Local PHP-FPM is 10 workers. */
export const OVERVIEW_AI_COPY_STREAM_CONCURRENCY = 3;

/** Shared AISEO file-slot harness row pool (same limit as Research batch). */
export const OVERVIEW_AISEO_ROW_CONCURRENCY_MAX = OVERVIEW_AI_COPY_STREAM_CONCURRENCY;

export async function mapOverviewAiCopyWithConcurrency<T>(
  items: readonly T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const limit = pLimit(OVERVIEW_AI_COPY_STREAM_CONCURRENCY);
  await Promise.all(items.map((item) => limit(() => fn(item))));
}
