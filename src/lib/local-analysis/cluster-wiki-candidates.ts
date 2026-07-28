import type { GridLocationBucket } from "@/lib/local-analysis/grid-location-buckets";
import { firstCityStateLabelFromAddress, regionFullNameFromPostalCode } from "@/lib/local-dominator-csv";

const REGION_CODE =
  /^(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/i;

const CA_PROVINCE = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);

export type ClusterWikiGeo = {
  city: string;
  regionCode: string;
  regionName: string;
};

export type ClusterWikiCandidateTiers = {
  /** Neighbourhood / district entity label (verified first). */
  neighbourhood: string[];
  /** City + full region when neighbourhood page is missing. */
  city: string[];
  geo: ClusterWikiGeo | null;
};

/** Canonical city Wikipedia title for fallback (e.g. Altona, Manitoba). */
export function clusterCityWikiTitle(geo: ClusterWikiGeo): string {
  return `${geo.city}, ${geo.regionName}`;
}

export function extractClusterWikiGeo(label: string): ClusterWikiGeo | null {
  const parts = label
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const regionCode = parts[parts.length - 1]!;
  if (!REGION_CODE.test(regionCode)) return null;
  const city = parts[parts.length - 2]!;
  if (!city) return null;
  const regionName = regionFullNameFromPostalCode(regionCode);
  if (!regionName) return null;
  return { city, regionCode, regionName };
}

function cityFromBucket(bucket: GridLocationBucket): string | null {
  for (const addr of bucket.sampleAddresses) {
    const city = firstCityStateLabelFromAddress(addr);
    if (city) return city;
  }
  return null;
}

function pushUnique(out: string[], seen: Set<string>, value: string | null | undefined): void {
  const v = value?.trim();
  if (!v) return;
  const key = v.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(v);
}

/** Neighbourhood first, then city + full region only. */
export function buildClusterWikiCandidateTiers(
  entity: string,
  bucket: GridLocationBucket,
): ClusterWikiCandidateTiers {
  const neighbourhood: string[] = [];
  const city: string[] = [];
  const seenN = new Set<string>();
  const seenC = new Set<string>();

  const trimmed = entity.trim();
  const parts = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  const geoFromEntity = extractClusterWikiGeo(trimmed);
  const geoFromBucket = extractClusterWikiGeo(cityFromBucket(bucket) ?? "");
  const geo = geoFromEntity ?? geoFromBucket;

  pushUnique(neighbourhood, seenN, trimmed);

  if (parts.length >= 3 && geo) {
    const placeHead = parts.slice(0, -2).join(", ");
    if (placeHead) {
      // Prefer city-qualified titles before bare head (avoids surname disambiguation pages).
      pushUnique(neighbourhood, seenN, `${placeHead}, ${geo.city}`);
      pushUnique(neighbourhood, seenN, `${placeHead}, ${geo.city}, ${geo.regionName}`);
      pushUnique(neighbourhood, seenN, placeHead);
    }
  } else if (parts.length >= 2 && geo) {
    const placeHead = parts[0]!;
    if (placeHead.toLowerCase() !== geo.city.toLowerCase()) {
      pushUnique(neighbourhood, seenN, `${placeHead}, ${geo.city}`);
      pushUnique(neighbourhood, seenN, placeHead);
    }
  }

  for (const g of [geoFromEntity, geoFromBucket]) {
    if (!g) continue;
    pushUnique(city, seenC, clusterCityWikiTitle(g));
    if (CA_PROVINCE.has(g.regionCode.toUpperCase())) {
      pushUnique(city, seenC, `${g.city}, ${g.regionName}, Canada`);
    }
  }

  return { neighbourhood, city, geo };
}

/** @deprecated Use {@link buildClusterWikiCandidateTiers}. */
export function buildClusterWikiCandidates(
  entity: string,
  bucket: GridLocationBucket,
): { candidates: string[]; geo: ClusterWikiGeo | null } {
  const tiers = buildClusterWikiCandidateTiers(entity, bucket);
  return {
    candidates: [...tiers.neighbourhood, ...tiers.city],
    geo: tiers.geo,
  };
}

export function isCityLevelWikiTitle(title: string, geo: ClusterWikiGeo | null): boolean {
  if (!geo) return false;
  const lower = title.trim().toLowerCase();
  const cityRegion = `${geo.city}, ${geo.regionName}`.toLowerCase();
  if (lower === cityRegion) return true;
  if (lower === `${cityRegion}, canada`) return true;
  return false;
}

/** Reject disambiguation pages and bare city hits when a region is known. */
export function isRejectedClusterWikiTitle(title: string, geo: ClusterWikiGeo | null): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/\(disambiguation\)$/i.test(t)) return true;
  if (!geo) return false;
  const lower = t.toLowerCase();
  const city = geo.city.trim().toLowerCase();
  if (lower === city) return true;
  if (lower === `city of ${city}`) return true;
  return false;
}

/** In neighbourhood tier, skip city/province articles so city tier can verify them. */
export function isRejectedNeighbourhoodWikiTitle(title: string, geo: ClusterWikiGeo | null): boolean {
  if (isRejectedClusterWikiTitle(title, geo)) return true;
  return isCityLevelWikiTitle(title, geo);
}
