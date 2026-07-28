/**
 * Parse DataForSEO Google My Business Info (live) JSON for storefront grounding.
 */

import { dataForSeoCountryNameFromRegion } from "@/lib/grid-entity-hint-breadth";
import {
  inferDataForSeoLocationNameFromWebsiteUrl,
  isLikelyDataForSeoGmbLocationName,
} from "@/lib/local-strategy-research/local-strategy-gmb-fetch";

export type GbpResolvedFromDfs = {
  title: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  city: string;
  region: string;
  phone: string;
  /** ISO 3166-1 alpha-2 from GBP `address_info`, when present. */
  countryCode?: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Walk DataForSEO `tasks[0].result[0].items` and return the first `google_business_info` item (raw object).
 */
export function getGoogleBusinessInfoItem(json: unknown): Record<string, unknown> | null {
  if (json == null || typeof json !== "object") return null;
  const root = json as {
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result?: Array<{ items?: unknown[] }>;
    }>;
  };
  const t0 = root.tasks?.[0];
  if (t0?.status_code != null && t0.status_code !== 20000) {
    return null;
  }
  const items = t0?.result?.[0]?.items;
  if (!Array.isArray(items) || items.length === 0) return null;

  const item = (items.find((x) => {
    const o = x as { type?: string };
    return o?.type === "google_business_info";
  }) ?? items[0]) as Record<string, unknown>;

  if (!item || typeof item !== "object") return null;
  return item;
}

/**
 * Best-effort `place_id` and `cid` from the first `google_business_info` item (for DataForSEO Reviews API).
 */
export function extractGmbDfsPlaceIdentifiers(json: unknown): { placeId: string | null; cid: string | null } {
  const item = getGoogleBusinessInfoItem(json);
  if (!item) return { placeId: null, cid: null };
  const rawPid = typeof item.place_id === "string" ? item.place_id.trim() : "";
  const placeId =
    rawPid && /^(ChIJ|GhIJ)/i.test(rawPid) ? (rawPid.startsWith("place_id:") ? rawPid.slice("place_id:".length) : rawPid) : null;
  let cidStr: string | null = null;
  if (typeof item.cid === "number" && Number.isFinite(item.cid)) {
    cidStr = String(Math.floor(item.cid));
  } else if (typeof item.cid === "string" && /^\d+$/.test(item.cid.trim())) {
    cidStr = item.cid.trim();
  }
  return { placeId: placeId || null, cid: cidStr };
}

/**
 * Map the first `google_business_info` item to storefront fields (title, address, phone, coords).
 */
export function parseGmbDfsBusinessInfo(json: unknown): GbpResolvedFromDfs | null {
  const item = getGoogleBusinessInfoItem(json);
  if (!item) return null;

  const ai = (item.address_info as Record<string, unknown> | undefined) ?? {};
  const addr =
    (typeof item.address === "string" && item.address.trim()) ||
    (typeof ai.address === "string" && ai.address.trim()) ||
    "";

  const title =
    (typeof item.title === "string" && item.title.trim()) ||
    (typeof item.original_title === "string" && item.original_title.trim()) ||
    "";

  const gps = item.gps_coordinates as Record<string, unknown> | undefined;
  const lat = num(item.latitude) ?? num(item.lat) ?? num(gps?.latitude);
  const lng = num(item.longitude) ?? num(item.lng) ?? num(gps?.longitude);

  const city = typeof ai.city === "string" ? ai.city.trim() : "";
  const region = typeof ai.region === "string" ? ai.region.trim() : "";
  const phone = typeof item.phone === "string" ? item.phone.trim() : "";
  const countryCodeRaw =
    typeof ai.country_code === "string" ? ai.country_code.trim().toUpperCase().replace(/\s+/g, "") : "";
  const countryCode = countryCodeRaw.length >= 2 ? countryCodeRaw.slice(0, 2) : "";

  if (!title && !addr && !city) return null;

  return {
    title,
    formattedAddress: addr,
    latitude: lat,
    longitude: lng,
    city,
    region,
    phone,
    ...(countryCode ? { countryCode } : {}),
  };
}

/**
 * Short markdown block for Local Analysis suggest (OpenRouter user message attachment).
 */
/**
 * Best-effort city/region from Integrations "Find location" / radius label (e.g. "Edmonton, AB").
 */
export function parseCityRegionFromLooseLabel(label: string | null | undefined): { city: string; region: string } {
  const s = (label ?? "").trim();
  if (!s) return { city: "", region: "" };
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0] ?? "", region: parts[1] ?? "" };
  }
  return { city: parts[0] ?? "", region: "" };
}

export function formatGbpContextForSuggestMarkdown(resolved: GbpResolvedFromDfs): string {
  const lines = [
    `**GBP / DataForSEO (Google Business Info)**`,
    resolved.title ? `- Business name: ${resolved.title}` : null,
    resolved.formattedAddress ? `- Address: ${resolved.formattedAddress}` : null,
    resolved.city || resolved.region
      ? `- City/region: ${[resolved.city, resolved.region].filter(Boolean).join(", ")}`
      : null,
    resolved.latitude != null && resolved.longitude != null
      ? `- Coordinates: ${resolved.latitude.toFixed(5)}, ${resolved.longitude.toFixed(5)}`
      : null,
    resolved.phone ? `- Phone: ${resolved.phone}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

const ISO2_TO_DFS_COUNTRY: Record<string, string> = {
  CA: "Canada",
  US: "United States",
  GB: "United Kingdom",
  AU: "Australia",
  NZ: "New Zealand",
  DE: "Germany",
  FR: "France",
  MX: "Mexico",
  IE: "Ireland",
  IN: "India",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  JP: "Japan",
  BR: "Brazil",
};

/** Last segment of DataForSEO `location_name`: country name only (e.g. Canada, United States). */
export function inferDataForSeoCountryNameFromGbp(gbp: GbpResolvedFromDfs, websiteUrl: string): string {
  const cc = gbp.countryCode?.trim().toUpperCase().slice(0, 2);
  if (cc && ISO2_TO_DFS_COUNTRY[cc]) return ISO2_TO_DFS_COUNTRY[cc];
  const fromRegion = dataForSeoCountryNameFromRegion(gbp.region);
  if (fromRegion) return fromRegion;
  return inferDataForSeoLocationNameFromWebsiteUrl(websiteUrl);
}

/**
 * DataForSEO SERP `location_name` when applying GBP defaults: **country name only** (e.g. Canada, United States).
 */
export function dataForSeoSerpLocationFromGbp(
  gbp: GbpResolvedFromDfs,
  websiteUrl: string,
): string | null {
  const country = inferDataForSeoCountryNameFromGbp(gbp, websiteUrl).trim();
  if (!country) return null;
  return isLikelyDataForSeoGmbLocationName(country) ? country : null;
}
