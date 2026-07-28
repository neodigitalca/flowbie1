import { normalizeFocusKeywordPhrase } from "@/lib/seo-redirect-csv";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { patchRowForNewFocusKeyword } from "@/components/overview/overview-meta-row-patches";

export type EntityKeywordDraftSpec = { keyword: string; rowCount: number };

/** Sequential assignment: each spec assigns up to `rowCount` rows until the table ends. */
export function applySpecsToRows(
  prev: OverviewRow[],
  specs: EntityKeywordDraftSpec[],
): { next: OverviewRow[]; assigned: number; totalRequested: number } | null {
  const n = prev.length;
  if (n === 0) return null;
  let totalRequested = 0;
  for (const spec of specs) {
    const kw = normalizeFocusKeywordPhrase(spec.keyword.trim());
    const count = Math.max(0, Math.round(Number(spec.rowCount)));
    if (!kw || count <= 0) continue;
    totalRequested += count;
  }
  if (totalRequested === 0) return null;
  let ri = 0;
  const next = [...prev];
  for (const spec of specs) {
    const kw = normalizeFocusKeywordPhrase(spec.keyword.trim());
    const count = Math.max(0, Math.round(Number(spec.rowCount)));
    if (!kw || count <= 0) continue;
    for (let j = 0; j < count && ri < n; j++) {
      next[ri] = patchRowForNewFocusKeyword(next[ri], kw);
      ri++;
    }
    if (ri >= n) break;
  }
  return { next, assigned: ri, totalRequested };
}
