export function normalizeGoogleAdsCustomerId(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export function microsToSpend(costMicros: number): number {
  return costMicros / 1_000_000;
}

export function adsCpa(costMicros: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return microsToSpend(costMicros) / conversions;
}

export function adsPctDelta(primary: number, compare: number): number | null {
  if (compare === 0) return null;
  return ((primary - compare) / compare) * 100;
}
