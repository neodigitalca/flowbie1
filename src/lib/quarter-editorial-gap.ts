import type { QuarterEditorialTileStats } from "@/lib/wordpress-api/types";

/** Editorial goals for the property tile quarter line (posts + entities in quarter). */
export const QUARTER_EDITORIAL_POSTS_GOAL = 9;
export const QUARTER_EDITORIAL_ENTITIES_GOAL = 45;

/** Max rows for a single OpenRouter gap-template run. */
export const QUARTER_GAP_BLOG_ROWS_CAP = 24;

export function quarterPostsTotal(stats: QuarterEditorialTileStats): number | null {
  if (stats.loading) return null;
  if (stats.postsLive === null || stats.postsScheduled === null) return null;
  return stats.postsLive + stats.postsScheduled;
}

/** Sum of entity live + scheduled in quarter; null when not applicable or unknown. */
export function quarterEntitiesTotal(stats: QuarterEditorialTileStats): number | null {
  if (stats.loading) return null;
  if (!stats.entityConfigured || !stats.entityCountsAvailable) return null;
  if (stats.entityLive === null || stats.entityScheduled === null) return null;
  return stats.entityLive + stats.entityScheduled;
}

/** True when post totals are known (not loading, both legs present). */
export function quarterPostTotalsReady(stats: QuarterEditorialTileStats): boolean {
  return !stats.loading && stats.postsLive !== null && stats.postsScheduled !== null;
}

/**
 * True when current quarter is below editorial goals: posts under 9, or entity counts
 * available and under 45.
 */
export function quarterStatsBelowGoals(stats: QuarterEditorialTileStats): boolean {
  if (!quarterPostTotalsReady(stats)) return false;
  const posts = quarterPostsTotal(stats);
  if (posts === null) return false;
  if (posts < QUARTER_EDITORIAL_POSTS_GOAL) return true;
  const entities = quarterEntitiesTotal(stats);
  if (entities === null) return false;
  return entities < QUARTER_EDITORIAL_ENTITIES_GOAL;
}

function shortPostsRaw(stats: QuarterEditorialTileStats): number {
  const posts = quarterPostsTotal(stats);
  if (posts === null) return 0;
  return Math.max(0, QUARTER_EDITORIAL_POSTS_GOAL - posts);
}

function shortEntitiesRaw(stats: QuarterEditorialTileStats): number {
  const entities = quarterEntitiesTotal(stats);
  if (entities === null) return 0;
  return Math.max(0, QUARTER_EDITORIAL_ENTITIES_GOAL - entities);
}

/**
 * Split row budgets: **blog** rows for post shortfall, **geo landing** rows for entity shortfall.
 * Total per download is capped at {@link QUARTER_GAP_BLOG_ROWS_CAP}; larger single gap is prioritized when both need rows.
 */
export function allocateQuarterGapRunCounts(
  stats: QuarterEditorialTileStats,
): { blogRows: number; sapRows: number } | null {
  if (!quarterPostTotalsReady(stats)) return null;
  const sp = shortPostsRaw(stats);
  const se = shortEntitiesRaw(stats);
  if (sp <= 0 && se <= 0) return null;

  const cap = QUARTER_GAP_BLOG_ROWS_CAP;
  if (sp > 0 && se === 0) {
    return { blogRows: Math.min(sp, cap), sapRows: 0 };
  }
  if (sp === 0 && se > 0) {
    return { blogRows: 0, sapRows: Math.min(se, cap) };
  }

  if (sp + se <= cap) {
    return { blogRows: sp, sapRows: se };
  }

  let blogRows = Math.min(sp, Math.floor((cap * sp) / (sp + se)));
  let sapRows = Math.min(se, cap - blogRows);
  if (sp > 0 && blogRows === 0) {
    blogRows = 1;
    sapRows = Math.min(se, cap - blogRows);
  }
  if (se > 0 && sapRows === 0) {
    sapRows = 1;
    blogRows = Math.min(sp, cap - sapRows);
  }
  return { blogRows, sapRows };
}

/**
 * Total checklist rows across blog + geo landing phases (for UI hints). Null when stats not ready.
 */
export function totalRowsFromQuarterGap(stats: QuarterEditorialTileStats): number | null {
  const a = allocateQuarterGapRunCounts(stats);
  if (!a) return null;
  const n = a.blogRows + a.sapRows;
  return n > 0 ? n : null;
}

/**
 * @deprecated Prefer {@link totalRowsFromQuarterGap} or {@link allocateQuarterGapRunCounts}.
 * Max single-leg shortfall capped (legacy single-phase count).
 */
export function blogCountFromQuarterGap(stats: QuarterEditorialTileStats): number | null {
  if (!quarterPostTotalsReady(stats)) return null;
  const posts = quarterPostsTotal(stats);
  if (posts === null) return null;
  const shortPosts = Math.max(0, QUARTER_EDITORIAL_POSTS_GOAL - posts);
  const entities = quarterEntitiesTotal(stats);
  const shortEntities =
    entities !== null ? Math.max(0, QUARTER_EDITORIAL_ENTITIES_GOAL - entities) : 0;
  const raw = Math.max(1, Math.max(shortPosts, shortEntities));
  return Math.min(raw, QUARTER_GAP_BLOG_ROWS_CAP);
}
