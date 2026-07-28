/**
 * After OpenRouter returns a CitationRecord, fill empty string fields from DataForSEO
 * `google_business_info` + business listing row so NAP/hours/URLs match API data, not only model copy.
 */

import type { WordPressSite } from "@/components/integrations/types";
import type { BusinessListingItem } from "@/lib/citation-research/dfs-business-listings-client";
import type { CitationRecord } from "@/lib/citation-research/citation-from-gmb-item";
import type { SerpSocialProfilesFromDfs } from "@/lib/citation-research/citation-serp-social";
import { getGoogleBusinessInfoItem } from "@/lib/gmb-dfs-parse";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function formatHM(h: number, m: number): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
}

function formatDaySlots(slots: unknown): string {
  if (!Array.isArray(slots) || slots.length === 0) return "";
  const parts = slots.map((slot) => {
    const s = slot as {
      open?: { hour?: number; minute?: number };
      close?: { hour?: number; minute?: number };
    };
    if (!s.open || !s.close) return "";
    const oh = s.open.hour ?? 0;
    const om = s.open.minute ?? 0;
    const ch = s.close.hour ?? 0;
    const cm = s.close.minute ?? 0;
    return `${formatHM(oh, om)}-${formatHM(ch, cm)}`;
  });
  return parts.filter(Boolean).join(", ");
}

function extractHoursFromItem(item: Record<string, unknown>): Partial<
  Pick<
    CitationRecord,
    | "hourMonday"
    | "hourTuesday"
    | "hourWednesday"
    | "hourThursday"
    | "hourFriday"
    | "hourSaturday"
    | "hourSunday"
  >
> {
  const out: Partial<
    Pick<
      CitationRecord,
      | "hourMonday"
      | "hourTuesday"
      | "hourWednesday"
      | "hourThursday"
      | "hourFriday"
      | "hourSaturday"
      | "hourSunday"
    >
  > = {};
  const wh = item.work_hours ?? item.work_time;
  if (!wh || typeof wh !== "object") return out;
  const t = (wh as { timetable?: Record<string, unknown> }).timetable;
  if (!t || typeof t !== "object") return out;

  const pairs: [string, keyof CitationRecord][] = [
    ["monday", "hourMonday"],
    ["tuesday", "hourTuesday"],
    ["wednesday", "hourWednesday"],
    ["thursday", "hourThursday"],
    ["friday", "hourFriday"],
    ["saturday", "hourSaturday"],
    ["sunday", "hourSunday"],
  ];
  for (const [day, key] of pairs) {
    const line = formatDaySlots(t[day]);
    if (line) out[key] = line;
  }
  return out;
}

function extractSocialFromLocalLinks(item: Record<string, unknown>): {
  instagram: string;
  linkedin: string;
  facebook: string;
} {
  const links = item.local_business_links;
  let instagram = "";
  let linkedin = "";
  let facebook = "";
  if (!Array.isArray(links)) return { instagram, linkedin, facebook };
  for (const L of links) {
    if (!L || typeof L !== "object") continue;
    const u = str((L as { url?: string }).url);
    if (!u) continue;
    const low = u.toLowerCase();
    if (!instagram && low.includes("instagram.com")) instagram = u;
    if (!linkedin && low.includes("linkedin.com")) linkedin = u;
    if (!facebook && (low.includes("facebook.com") || low.includes("fb.com"))) facebook = u;
  }
  return { instagram, linkedin, facebook };
}

export function citationPartialFromGoogleBusinessItem(item: Record<string, unknown>): Partial<CitationRecord> {
  const ai = (item.address_info as Record<string, unknown> | undefined) ?? {};
  const addr =
    str(item.address) ||
    [str(ai.address), str(ai.city), str(ai.region), str(ai.zip)].filter(Boolean).join(", ");
  const phone = str(item.phone);
  const gmbUrl = str(item.url) || str(item.contact_url);
  const dom = str(item.domain);
  const websiteUrl = dom ? (dom.startsWith("http") ? dom : `https://${dom}`) : "";
  const title = str(item.title) || str(item.original_title);
  const logo = str(item.logo);
  const mainIm = str(item.main_image);
  const logoWide = logo || mainIm;
  const logoSquare = mainIm || logo;
  const { instagram, linkedin, facebook } = extractSocialFromLocalLinks(item);
  const descSnippet = str(item.description) || str(item.snippet);
  const hours = extractHoursFromItem(item);

  return {
    businessName: title,
    address: addr,
    phone,
    websiteUrl,
    gmbUrl,
    logoWide,
    logoSquare,
    instagramUrl: instagram,
    linkedinUrl: linkedin,
    facebookUrl: facebook,
    description: descSnippet,
    ...hours,
  };
}

export function citationPartialFromBusinessListing(listing: BusinessListingItem | null): Partial<CitationRecord> {
  if (!listing) return {};
  const phone = str(listing.phone ?? listing.phone_number ?? listing["phone_number"]);
  const addr =
    str(listing.address) ||
    str(listing.snippet) ||
    str(listing.formatted_address) ||
    "";
  const name = str(listing.title) || str(listing.name);
  const url = str(listing.url ?? listing.link ?? listing.website);
  const out: Partial<CitationRecord> = {};
  if (phone) out.phone = phone;
  if (addr) out.address = addr;
  if (name) out.businessName = name;
  if (url) out.websiteUrl = url.startsWith("http") ? url : `https://${url}`;
  return out;
}

/** Last resort: Integrations NAP saved on the site (does not replace DataForSEO when those strings are set). */
export function citationPartialFromSiteNap(site: WordPressSite | null | undefined): Partial<CitationRecord> {
  if (!site?.napInfo) return {};
  const n = site.napInfo;
  const out: Partial<CitationRecord> = {};
  const name = str(n.name);
  const addr = str(n.address);
  const phone = str(n.phone);
  if (name) out.businessName = name;
  if (addr) out.address = addr;
  if (phone) out.phone = phone;
  return out;
}

/**
 * When DataForSEO Google organic returns a hit for `site:linkedin.com` / `site:instagram.com` / `site:facebook.com`,
 * use it for those fields (overrides earlier merge from GMB listing links when present).
 */
export function applySerpSocialOverridesFromDfs(
  rec: CitationRecord,
  p: SerpSocialProfilesFromDfs,
): CitationRecord {
  const out = { ...rec };
  const li = str(p.linkedinUrl);
  const ig = str(p.instagramUrl);
  const fb = str(p.facebookUrl);
  if (li) out.linkedinUrl = li;
  if (ig) out.instagramUrl = ig;
  if (fb) out.facebookUrl = fb;
  return out;
}

/**
 * Merge: keep first non-empty trimmed string per field (OpenRouter first, then DFS partials in order).
 */
export function mergeCitationRecordWithDfsPartials(
  base: CitationRecord,
  ...partials: Partial<CitationRecord>[]
): CitationRecord {
  const keys = Object.keys(base) as (keyof CitationRecord)[];
  const merged = { ...base };
  for (const k of keys) {
    const cur = str(merged[k]);
    if (cur) continue;
    for (const p of partials) {
      const next = str(p[k]);
      if (next) {
        merged[k] = next;
        break;
      }
    }
  }
  return merged;
}

export function buildCitationDfsPartials(args: {
  googleBusinessInfoLiveResponse: unknown | null;
  pickedBusinessListingRow: BusinessListingItem | null;
  site?: WordPressSite | null;
}): Partial<CitationRecord>[] {
  const out: Partial<CitationRecord>[] = [];
  const item = args.googleBusinessInfoLiveResponse
    ? getGoogleBusinessInfoItem(args.googleBusinessInfoLiveResponse)
    : null;
  if (item) out.push(citationPartialFromGoogleBusinessItem(item));
  out.push(citationPartialFromBusinessListing(args.pickedBusinessListingRow));
  out.push(citationPartialFromSiteNap(args.site ?? null));
  return out;
}
