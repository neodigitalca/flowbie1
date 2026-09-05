import type { WordPressSite } from "@/components/integrations/types";

export const WORDPRESS_BENCHMARK_CATEGORY_TAGS_KEY = "wordpress_benchmark_category_tags";
export const BENCHMARK_CATEGORY_TAG_MAX_LENGTH = 80;

export function normalizeBenchmarkCategoryTag(raw: string): string {
  return raw.trim().slice(0, BENCHMARK_CATEGORY_TAG_MAX_LENGTH);
}

export function benchmarkCategoryTagKey(label: string): string {
  return normalizeBenchmarkCategoryTag(label).toLocaleLowerCase();
}

function uniqueTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const label = normalizeBenchmarkCategoryTag(item);
    if (!label) continue;
    const key = benchmarkCategoryTagKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

export function readBenchmarkCategoryTags(): string[] {
  try {
    const raw = localStorage.getItem(WORDPRESS_BENCHMARK_CATEGORY_TAGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return uniqueTags(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return [];
  }
}

export function writeBenchmarkCategoryTags(tags: string[]): void {
  try {
    localStorage.setItem(WORDPRESS_BENCHMARK_CATEGORY_TAGS_KEY, JSON.stringify(uniqueTags(tags)));
  } catch {
    /* quota or private mode: site assignment still persists */
  }
}

export function addBenchmarkCategoryTag(raw: string): string[] {
  const label = normalizeBenchmarkCategoryTag(raw);
  const current = readBenchmarkCategoryTags();
  if (!label) return current;
  const key = benchmarkCategoryTagKey(label);
  if (current.some((tag) => benchmarkCategoryTagKey(tag) === key)) {
    return current;
  }
  const next = uniqueTags([...current, label]);
  writeBenchmarkCategoryTags(next);
  return next;
}

export function collectBenchmarkCategoryTags(
  sites: Array<Pick<WordPressSite, "benchmarkCustomTag">>,
  extras: string[] = [],
): string[] {
  return uniqueTags([
    ...readBenchmarkCategoryTags(),
    ...sites.map((site) => site.benchmarkCustomTag ?? ""),
    ...extras,
  ]);
}
