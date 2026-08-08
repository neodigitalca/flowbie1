export const COMPETITOR_DEFAULT_BUDGET = 1;
export const COMPETITOR_DEFAULT_BUDGET_INPUT = String(COMPETITOR_DEFAULT_BUDGET);

/** Digits-only competitor count field; empty string allowed while editing. */
export function normalizeCompetitorBudgetInputChange(raw: string): string {
  if (raw === "") return "";
  return raw.replace(/[^\d]/g, "");
}

export function parseCompetitorBudgetInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const n = Math.floor(Number(trimmed));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function stepCompetitorBudgetInput(raw: string, direction: "up" | "down"): string | null {
  const n = parseCompetitorBudgetInput(raw);
  if (n === null) return null;
  const next = direction === "up" ? n + 1 : n - 1;
  if (next < 1) return null;
  return String(next);
}
