import type { LinkTargetsPlan } from "@/lib/bulk/bulk-generation-wp-inventory";
import { normalizeInternalLinkUrl } from "@/lib/content-generation/internal-link-intent-match";
import type { InternalLinkQuery } from "@/lib/content-generation/internal-link-intent-match";

function normalizeLinkQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic query → URL map from a predetermined link targets plan. */
export function buildLinkTargetsQueryUrlMap(plan: LinkTargetsPlan): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of [...plan.pageTargets, ...plan.blogTargets]) {
    const query = entry.query?.trim();
    const url = entry.url?.trim();
    if (!query || !url) continue;
    map.set(normalizeLinkQuery(query), url);
  }
  return map;
}

/**
 * Resolve [[LINK:query|anchor]] slots using the link targets plan only (no catalog re-match).
 * Query must match a plan entry exactly (case-insensitive, whitespace-normalized).
 */
export function matchInternalLinkQueriesFromPlan(
  queries: InternalLinkQuery[],
  plan: LinkTargetsPlan,
): Map<string, string> {
  const queryUrlMap = buildLinkTargetsQueryUrlMap(plan);
  const out = new Map<string, string>();
  for (const q of queries) {
    const url = queryUrlMap.get(normalizeLinkQuery(q.query));
    if (url) out.set(q.id, url);
  }
  return out;
}

export function linkTargetsPlanUrlForQuery(
  query: string,
  plan: LinkTargetsPlan,
): string | undefined {
  const map = buildLinkTargetsQueryUrlMap(plan);
  return map.get(normalizeLinkQuery(query));
}

export function linkTargetsPlanEntryForUrl(
  url: string,
  plan: LinkTargetsPlan,
): { title: string; query: string; suggestedAnchor?: string } | undefined {
  const key = normalizeInternalLinkUrl(url);
  for (const entry of [...plan.pageTargets, ...plan.blogTargets]) {
    if (normalizeInternalLinkUrl(entry.url) === key) {
      return {
        title: entry.title,
        query: entry.query,
        suggestedAnchor: entry.suggestedAnchor,
      };
    }
  }
  return undefined;
}
