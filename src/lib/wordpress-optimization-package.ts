/** Tiers for per-editorial-period optimization caps (Integrations site settings). */
export type OptimizationPackageTier = "basic" | "pro" | "plus";

export const OPTIMIZATION_PACKAGE_CAPS: Record<OptimizationPackageTier, number> = {
  basic: 50,
  pro: 100,
  plus: 200,
};

export const OPTIMIZATION_PACKAGE_LABELS: Record<OptimizationPackageTier, string> = {
  basic: "Basic (50 per period)",
  pro: "Pro (100 per period)",
  plus: "Plus (200 per period)",
};

/** Cap for the tier, or `null` when unset (no package limit). */
export function optimizationPeriodCapForPackage(
  tier: OptimizationPackageTier | undefined | null,
): number | null {
  if (!tier) return null;
  return OPTIMIZATION_PACKAGE_CAPS[tier] ?? null;
}

export function isOptimizationPackageTier(value: string): value is OptimizationPackageTier {
  return value === "basic" || value === "pro" || value === "plus";
}

/** True when the property tile should show and enforce a period cap (e.g. 154/50). */
export function siteHasOptimizationPeriodCap(
  tier: OptimizationPackageTier | undefined | null,
): boolean {
  return optimizationPeriodCapForPackage(tier) != null;
}

/**
 * Fisher-Yates shuffle (copy). Uses `crypto.getRandomValues` when available for unbiased picks.
 */
export function shuffleUrlsCopy<T>(items: T[]): T[] {
  const out = [...items];
  const n = out.length;
  if (n <= 1) return out;
  const randomUint32 = () => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0]! / 4294967296;
    }
    return Math.random();
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(randomUint32() * (i + 1));
    const t = out[i]!;
    out[i] = out[j]!;
    out[j] = t;
  }
  return out;
}

export function takeRandomSample<T>(items: T[], count: number): T[] {
  if (count <= 0 || items.length === 0) return [];
  const k = Math.min(count, items.length);
  return shuffleUrlsCopy(items).slice(0, k);
}

/** Compare REST `date` vs `modified` at second precision (ignore sub-second noise). */
export function normalizeWpIsoToSecond(iso: string): string {
  const t = iso?.trim();
  if (!t) return "";
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) return t;
  return new Date(Math.floor(ms / 1000) * 1000).toISOString();
}

export function wpModifiedIndicatesOptimization(dateIso: string, modifiedIso: string): boolean {
  return normalizeWpIsoToSecond(dateIso) !== normalizeWpIsoToSecond(modifiedIso);
}
