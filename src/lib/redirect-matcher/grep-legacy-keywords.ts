import type { WordPressSite } from "@/components/integrations/types";
import { humanizeSlugFromUrl } from "@/hooks/content-optimization/bulk-optimization-constants";
import { findEndpointFromSitemap } from "@/hooks/content-optimization/optimization-helpers-b";
import { stripHtmlToPlainText, truncatePlainText } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { normalizeFocusKeywordPhrase } from "@/lib/rank-math-redirect-csv";
import {
  REDIRECT_MATCHER_BODY_EXCERPT_MAX,
  REDIRECT_MATCHER_GREP_CONCURRENCY,
} from "@/lib/redirect-matcher/constants";
import type { LegacyEnrichedRow, LegacyUrlRow } from "@/lib/redirect-matcher/types";
import { getFieldsForUrlsBatch } from "@/lib/wordpress-api/fields-client";
import { WORDPRESS_BULK_READ_CHUNK } from "@/lib/wordpress-api/bulk-read-chunk";

function keywordFromAcfFields(fields: Record<string, unknown>): string {
  const kw = fields.keyword_focus ?? fields.focus_keyword;
  if (typeof kw === "string" && kw.trim()) {
    return normalizeFocusKeywordPhrase(kw) || "";
  }
  return "";
}

function metaFromSnapshot(snapshot: { title?: string; excerpt?: string }): string {
  const excerpt = stripHtmlToPlainText(snapshot.excerpt ?? "");
  if (excerpt) return truncatePlainText(excerpt, 300);
  const title = snapshot.title?.trim();
  return title || "";
}

function bodyFromSnapshot(snapshot: { content?: string; excerpt?: string }): string {
  const plain = stripHtmlToPlainText(snapshot.content ?? snapshot.excerpt ?? "");
  return truncatePlainText(plain, REDIRECT_MATCHER_BODY_EXCERPT_MAX);
}

function emptyEnrichedRow(row: LegacyUrlRow): LegacyEnrichedRow {
  const slugTitle = humanizeSlugFromUrl(row.legacyUrl);
  return {
    ...row,
    title: slugTitle,
    meta: "",
    bodyExcerpt: "",
    focusKeyword: slugTitle,
    slugTitle,
    grepResolved: false,
  };
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal,
): Promise<R[]> {
  const n = items.length;
  const ret: R[] = new Array(n);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const idx = next++;
      if (idx >= n) return;
      ret[idx] = await fn(items[idx]!);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), n);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return ret;
}

export async function grepLegacyKeywords(
  site: WordPressSite,
  rows: LegacyUrlRow[],
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number) => void,
): Promise<LegacyEnrichedRow[]> {
  const enriched = rows.map(emptyEnrichedRow);
  const misses: Array<{ index: number; targetUrl: string; endpointHint: string | undefined }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const targetUrl = rows[i]!.legacyUrl;
    const endpointHint = site.manualEndpoint || findEndpointFromSitemap(targetUrl, site);
    misses.push({ index: i, targetUrl, endpointHint });
  }

  const chunks: Array<typeof misses> = [];
  for (let i = 0; i < misses.length; i += WORDPRESS_BULK_READ_CHUNK) {
    chunks.push(misses.slice(i, i + WORDPRESS_BULK_READ_CHUNK));
  }

  let done = 0;
  const total = misses.length;

  await mapWithConcurrency(
    chunks,
    REDIRECT_MATCHER_GREP_CONCURRENCY,
    async (chunk) => {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const batch = await getFieldsForUrlsBatch(
        site,
        chunk.map((m) => ({ url: m.targetUrl, postTypeEndpointHint: m.endpointHint })),
        true,
      );

      for (let j = 0; j < chunk.length; j += 1) {
        const m = chunk[j]!;
        const row = batch.results[j];
        const base = enriched[m.index]!;

        if (row?.success && row.fields && Object.keys(row.fields).length > 0) {
          const acfKw = keywordFromAcfFields(row.fields);
          const snapshot = row.postSnapshot;
          const title =
            stripHtmlToPlainText(snapshot?.title ?? "") ||
            humanizeSlugFromUrl(m.targetUrl);
          const focusKeyword = acfKw || title;
          enriched[m.index] = {
            ...base,
            title,
            meta: snapshot ? metaFromSnapshot(snapshot) : base.meta,
            bodyExcerpt: snapshot ? bodyFromSnapshot(snapshot) : base.bodyExcerpt,
            focusKeyword,
            slugTitle: humanizeSlugFromUrl(m.targetUrl),
            grepResolved: true,
          };
        }

        done += 1;
        onProgress?.(done, total);
      }
    },
    signal,
  );

  return enriched;
}
