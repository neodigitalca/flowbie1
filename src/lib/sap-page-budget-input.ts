import { LOCAL_ANALYSIS_SAP_MIN } from "@/lib/local-analysis-target-constants";

/** Digits-only budget field value; empty string allowed while editing. */
export function normalizeSapPageBudgetInputChange(raw: string): string {
  if (raw === "") return "";
  return raw.replace(/[^\d]/g, "");
}

/** Parsed budget for caps and row sync; empty or invalid uses min (does not rewrite the input). */
export function sapBudgetIntFromLooseInput(
  raw: string,
  min = LOCAL_ANALYSIS_SAP_MIN,
): number {
  const digits = raw.trim().replace(/[^\d]/g, "");
  if (!digits) return min;
  const n = Math.floor(Number(digits));
  if (!Number.isFinite(n) || n < 1) return min;
  return n;
}

export function stepSapPageBudgetInput(raw: string, delta: 1 | -1): string {
  const current = sapBudgetIntFromLooseInput(raw);
  const next = Math.max(LOCAL_ANALYSIS_SAP_MIN, current + delta);
  return String(next);
}
