/**
 * Citation record shape + helpers for DataForSEO request parameters (Business Listings title, GMB keyword).
 * Field filling for the citation UI is done only via OpenRouter - see citation-extract-openrouter.ts.
 */

import type { WordPressSite } from "@/components/integrations/types";
import type { BusinessListingItem } from "@/lib/citation-research/dfs-business-listings-client";

/** Title query for Business Listings Search - site display name + optional seed keyword. */
export function buildBusinessListingsTitleQuery(site: WordPressSite, seedKeyword?: string): string {
  const napName = site.napInfo?.name?.trim();
  const siteName = site.name.trim();
  const seed = seedKeyword?.trim();
  const base = napName || siteName || "";
  if (base && seed) return `${base} ${seed}`.trim();
  if (base) return base;
  if (seed) return seed;
  try {
    const u = new URL(site.siteUrl.includes("://") ? site.siteUrl : `https://${site.siteUrl}`);
    return u.hostname.replace(/^www\./i, "") || "business";
  } catch {
    return "business";
  }
}

export type CitationRecord = {
  businessName: string;
  address: string;
  phone: string;
  websiteUrl: string;
  gmbUrl: string;
  description: string;
  keywords: string;
  logoWide: string;
  logoSquare: string;
  instagramUrl: string;
  linkedinUrl: string;
  facebookUrl: string;
  /** Extra profile / SERP URLs (one per line). */
  discoveredUrls: string;
  hourMonday: string;
  hourTuesday: string;
  hourWednesday: string;
  hourThursday: string;
  hourFriday: string;
  hourSaturday: string;
  hourSunday: string;
};

/** Split "Monday: … Tuesday: …" on one line into one line per day (model / paste blobs). */
export function splitCondensedHoursBlob(blob: string): string | null {
  const t = blob.trim();
  if (!t) return null;
  const re = /\s*(?=(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*:)/i;
  const parts = t.split(re).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return null;
  return parts.join("\n");
}

function citationDayLine(day: string, value: string): string {
  const v = value.trim();
  if (!v) return `${day}: - `;
  const re = new RegExp(`^${day}\\s*:`, "i");
  if (re.test(v)) return v;
  return `${day}: ${v}`;
}

/**
 * One line per day for UI and clipboard. Expands condensed "Monday: … Tuesday: …" when the model uses one line.
 */
export function formatCitationHoursVertical(record: CitationRecord): string {
  const pairs: [string, string][] = [
    ["Monday", record.hourMonday],
    ["Tuesday", record.hourTuesday],
    ["Wednesday", record.hourWednesday],
    ["Thursday", record.hourThursday],
    ["Friday", record.hourFriday],
    ["Saturday", record.hourSaturday],
    ["Sunday", record.hourSunday],
  ];
  const joined = pairs.map(([, v]) => v.trim()).join(" ").trim();
  const split = splitCondensedHoursBlob(joined);
  if (split) return split;
  return pairs.map(([d, v]) => citationDayLine(d, v)).join("\n");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isAllDigits(s: string): boolean {
  if (!s) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

/**
 * Keyword string for DataForSEO GMB Info - prefer cid / place_id when present on the listing.
 */
export function buildGmbKeywordFromListingAndContext(args: {
  listing: BusinessListingItem | null;
  businessTitleFallback: string;
  cityRegionLine: string;
  /** When Integrations has no address (e.g. temp seed), use this as disambiguation for Maps search. */
  seedKeyword?: string;
}): string {
  const { listing, businessTitleFallback, cityRegionLine, seedKeyword } = args;
  if (listing) {
    const cid = listing.cid;
    if (typeof cid === "number" && Number.isFinite(cid)) {
      return `cid:${cid}`;
    }
    const cs = str(listing.cid);
    if (cs.length > 0 && isAllDigits(cs)) {
      return `cid:${cs}`;
    }
    const pid = str(listing.place_id);
    if (pid) {
      if (pid.startsWith("ChIJ") || pid.startsWith("GhIJ")) return pid;
      return pid.startsWith("place_id:") ? pid : `place_id:${pid}`;
    }
  }
  const title = businessTitleFallback.trim();
  const geo = cityRegionLine.trim();
  const seed = seedKeyword?.trim() ?? "";
  if (title && geo) return `${title} ${geo}`;
  if (title && seed) return `${title} ${seed}`.trim();
  if (title) return title;
  if (geo && seed) return `${geo} ${seed}`.trim();
  return geo || seed || "business";
}
