import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { parseFaqEntries } from "@/lib/faq-entries";
import { keywordUniquenessKey } from "@/lib/local-analysis-fill-keywords-from-wp-inventory";
import { overviewTitlePrimarySegment } from "@/lib/overview/overview-tab-display";
import { isNumberedSlugDuplicateHref } from "@/lib/overview/overview-blog-links-agent-payload";
import { suggestedPathFromFocusKeywordForMetaOptimizer } from "@/lib/seo-redirect-csv";
import { normalizeDedupeKey } from "@/lib/vertical-benchmark/vertical-benchmark-bulk-dedupe";

export type OverviewRowErrorFilterKey =
  | "no_keyword"
  | "url_longer_than_keyword"
  | "empty_title"
  | "empty_meta"
  | "empty_faq"
  | "empty_date"
  | "empty_brief"
  | "duplicate_keyword"
  | "duplicate_title"
  | "duplicate_meta"
  | "duplicate_url";

export type OverviewRowErrorFilterGroup = {
  label: string;
  options: ReadonlyArray<{ key: OverviewRowErrorFilterKey; label: string }>;
};

export const OVERVIEW_ROW_ERROR_FILTER_GROUPS: ReadonlyArray<OverviewRowErrorFilterGroup> = [
  {
    label: "Keyword & URL",
    options: [
      { key: "no_keyword", label: "No keyword" },
      { key: "url_longer_than_keyword", label: "URL longer than keyword" },
    ],
  },
  {
    label: "Empty fields",
    options: [
      { key: "empty_title", label: "Empty title" },
      { key: "empty_meta", label: "Empty meta" },
      { key: "empty_faq", label: "Empty FAQ" },
      { key: "empty_date", label: "Empty date" },
      { key: "empty_brief", label: "Empty brief" },
    ],
  },
  {
    label: "Duplicates",
    options: [
      { key: "duplicate_keyword", label: "Duplicate keyword" },
      { key: "duplicate_title", label: "Duplicate title" },
      { key: "duplicate_meta", label: "Duplicate meta" },
      { key: "duplicate_url", label: "Duplicate URL" },
    ],
  },
];

/** @deprecated Use OVERVIEW_ROW_ERROR_FILTER_GROUPS */
export const OVERVIEW_ROW_ERROR_FILTER_OPTIONS = OVERVIEW_ROW_ERROR_FILTER_GROUPS.flatMap(
  (group) => group.options,
);

export type OverviewRowErrorFilterContext = {
  duplicateKeywordUrls: Set<string>;
  duplicateTitleUrls: Set<string>;
  duplicateMetaUrls: Set<string>;
};

export function buildOverviewRowErrorFilterContext(
  rows: OverviewRow[],
): OverviewRowErrorFilterContext {
  const keywordUrls = new Map<string, string[]>();
  const titleUrls = new Map<string, string[]>();
  const metaUrls = new Map<string, string[]>();

  for (const row of rows) {
    const kwKey = keywordUniquenessKey(row.focusKeyword ?? "");
    if (kwKey) {
      const list = keywordUrls.get(kwKey) ?? [];
      list.push(row.url);
      keywordUrls.set(kwKey, list);
    }

    const titleKey = normalizeDedupeKey(overviewTitlePrimarySegment(row.title));
    if (titleKey) {
      const list = titleUrls.get(titleKey) ?? [];
      list.push(row.url);
      titleUrls.set(titleKey, list);
    }

    const metaKey = normalizeDedupeKey((row.metaDescription ?? "").trim());
    if (metaKey) {
      const list = metaUrls.get(metaKey) ?? [];
      list.push(row.url);
      metaUrls.set(metaKey, list);
    }
  }

  const duplicateKeywordUrls = new Set<string>();
  for (const urls of keywordUrls.values()) {
    if (urls.length > 1) {
      for (const url of urls) duplicateKeywordUrls.add(url);
    }
  }

  const duplicateTitleUrls = new Set<string>();
  for (const urls of titleUrls.values()) {
    if (urls.length > 1) {
      for (const url of urls) duplicateTitleUrls.add(url);
    }
  }

  const duplicateMetaUrls = new Set<string>();
  for (const urls of metaUrls.values()) {
    if (urls.length > 1) {
      for (const url of urls) duplicateMetaUrls.add(url);
    }
  }

  return { duplicateKeywordUrls, duplicateTitleUrls, duplicateMetaUrls };
}

function overviewRowHasEmptyFaq(row: OverviewRow): boolean {
  const entries = parseFaqEntries(row.faq);
  if (entries.length === 0) return true;
  return entries.every((entry) => !entry.question.trim() && !entry.answer.trim());
}

export function overviewRowHasError(
  row: OverviewRow,
  key: OverviewRowErrorFilterKey,
  context?: OverviewRowErrorFilterContext,
): boolean {
  if (key === "no_keyword") {
    return !(row.focusKeyword ?? "").trim();
  }
  if (key === "empty_title") {
    return !overviewTitlePrimarySegment(row.title);
  }
  if (key === "empty_meta") {
    return !(row.metaDescription ?? "").trim();
  }
  if (key === "empty_faq") {
    return overviewRowHasEmptyFaq(row);
  }
  if (key === "empty_date") {
    return !(row.dateModifier ?? "").trim();
  }
  if (key === "empty_brief") {
    return !(row.seoResearch ?? "").trim();
  }
  if (key === "duplicate_keyword") {
    return context?.duplicateKeywordUrls.has(row.url) ?? false;
  }
  if (key === "duplicate_title") {
    return context?.duplicateTitleUrls.has(row.url) ?? false;
  }
  if (key === "duplicate_meta") {
    return context?.duplicateMetaUrls.has(row.url) ?? false;
  }
  if (key === "duplicate_url") {
    return isNumberedSlugDuplicateHref(row.url);
  }

  const kw = (row.focusKeyword ?? "").trim();
  if (!kw) return false;
  try {
    const pathname = new URL(row.url).pathname || "/";
    return suggestedPathFromFocusKeywordForMetaOptimizer(pathname, kw).kind === "set";
  } catch {
    return false;
  }
}

export function overviewRowMatchesErrorFilters(
  row: OverviewRow,
  active: Set<OverviewRowErrorFilterKey>,
  allRows?: OverviewRow[],
): boolean {
  if (active.size === 0) return true;
  const context = allRows ? buildOverviewRowErrorFilterContext(allRows) : undefined;
  for (const key of active) {
    if (overviewRowHasError(row, key, context)) return true;
  }
  return false;
}

export function countOverviewRowsByErrorFilter(
  rows: OverviewRow[],
): Record<OverviewRowErrorFilterKey, number> {
  const context = buildOverviewRowErrorFilterContext(rows);
  const counts = Object.fromEntries(
    OVERVIEW_ROW_ERROR_FILTER_OPTIONS.map(({ key }) => [key, 0]),
  ) as Record<OverviewRowErrorFilterKey, number>;

  for (const row of rows) {
    for (const { key } of OVERVIEW_ROW_ERROR_FILTER_OPTIONS) {
      if (overviewRowHasError(row, key, context)) counts[key]++;
    }
  }
  return counts;
}
