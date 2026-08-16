import { LOCAL_ANALYSIS_SAP_MIN } from "@/lib/local-analysis-target-constants";

export const DEFAULT_ENTITY_AD_GROUP_COUNT = 1;
export const DEFAULT_ENTITY_ADS_PER_GROUP = 1;

export function normalizeEntityCountInputChange(raw: string): string {
  if (raw === "") return "";
  return raw.replace(/[^\d]/g, "");
}

export function entityCountFromInput(
  raw: string,
  fallback = LOCAL_ANALYSIS_SAP_MIN,
): number {
  const digits = raw.trim().replace(/[^\d]/g, "");
  if (!digits) return fallback;
  const n = Math.floor(Number(digits));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export function entityAdGroupCountFromInput(raw: string): number {
  return entityCountFromInput(raw, DEFAULT_ENTITY_AD_GROUP_COUNT);
}

export function entityAdsPerGroupFromInput(raw: string): number {
  return entityCountFromInput(raw, DEFAULT_ENTITY_ADS_PER_GROUP);
}

export function entitySapTotalFromParts(adGroupCount: number, adsPerGroup: number): number {
  const groups = Math.max(1, Math.floor(adGroupCount) || DEFAULT_ENTITY_AD_GROUP_COUNT);
  const ads = Math.max(1, Math.floor(adsPerGroup) || DEFAULT_ENTITY_ADS_PER_GROUP);
  return groups * ads;
}

export function stepEntityCountInput(raw: string, delta: 1 | -1): string {
  const current = entityCountFromInput(raw);
  return String(Math.max(LOCAL_ANALYSIS_SAP_MIN, current + delta));
}

/** Flat entity list: each unique entity repeated adsPerGroup times (cycles if fewer picks than ad groups). */
export function expandEntityLabelsForLayout(
  uniqueEntities: readonly string[],
  adGroupCount: number,
  adsPerGroup: number,
): string[] {
  const groups = Math.max(1, Math.floor(adGroupCount) || DEFAULT_ENTITY_AD_GROUP_COUNT);
  const ads = Math.max(1, Math.floor(adsPerGroup) || DEFAULT_ENTITY_ADS_PER_GROUP);
  const picks = uniqueEntities.map((e) => e.trim()).filter(Boolean);
  if (picks.length === 0) return [];

  const groupEntities: string[] = [];
  for (let g = 0; g < groups; g++) {
    groupEntities.push(picks[g % picks.length]!);
  }

  return groupEntities.flatMap((entity) => Array.from({ length: ads }, () => entity));
}
