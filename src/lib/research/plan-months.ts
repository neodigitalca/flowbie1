/**
 * Shared plan horizon for strategist reports (competitor + local blueprint).
 * Standalone tabs use defaults; Proposal passes one UI-driven value to both agents.
 */

/** Default when the Local Strategy tab runs without an override. */
export const DEFAULT_LOCAL_STRATEGY_PLAN_MONTHS = 4;

/** Default when the Competitor tab runs without an override. */
export const DEFAULT_COMPETITOR_PLAN_MONTHS = 3;

export function clampPlanMonths(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  const x = Math.floor(n);
  if (x < 1) return 1;
  if (x > 12) return 12;
  return x;
}

/** Title-case fragment for H1s, e.g. `4-Month`. */
export function planMonthsTitleFragment(months: number): string {
  return `${clampPlanMonths(months, 1)}-Month`;
}

/** Lowercase fragment for prose, e.g. `4-month`. */
export function planMonthsLowerFragment(months: number): string {
  return `${clampPlanMonths(months, 1)}-month`;
}
