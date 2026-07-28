/**
 * DataForSEO Google organic SERP: generic discovery + targeted `site:` queries for social profiles.
 */

import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { inferDataForSeoLocationNameFromWebsiteUrl } from "@/lib/local-strategy-research/local-strategy-gmb-fetch";

export function hostFromWebsiteUrl(websiteUrl: string): string {
  const raw = websiteUrl.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function extractOrganicUrls(serpJson: unknown): string[] {
  const root = serpJson as {
    tasks?: Array<{
      status_code?: number;
      result?: Array<{ items?: unknown[] }>;
    }>;
  };
  const t0 = root.tasks?.[0];
  if (t0?.status_code != null && t0.status_code !== 20000) {
    return [];
  }
  const items = t0?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const urls: string[] = [];
  for (const it of items) {
    const o = it as { type?: string; url?: string };
    if (typeof o.url !== "string" || !o.url.startsWith("http")) continue;
    if (o.type === undefined || o.type === "organic") {
      urls.push(o.url);
    }
  }
  return urls;
}

async function postSerpOrganic(args: {
  keyword: string;
  location_name: string;
  depth: number;
  signal?: AbortSignal;
}): Promise<string[]> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const url = `${base}/api/mcp/DataForSEO_serp_organic_live_advanced`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword: args.keyword,
      location_name: args.location_name,
      language_code: "en",
      depth: args.depth,
    }),
    signal: args.signal,
  });
  const j = (await res.json()) as { error?: string };
  if (!res.ok) {
    return [];
  }
  return extractOrganicUrls(j);
}

function hostnameNorm(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function pickFirstUrlForHost(
  urls: string[],
  hostEndsWith: string,
  rejectPathPrefixes?: string[],
): string {
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      if (!hostnameNorm(u.hostname).endsWith(hostEndsWith)) continue;
      const path = u.pathname.toLowerCase();
      if (rejectPathPrefixes?.some((p) => path === p || path.startsWith(`${p}/`))) continue;
      return raw;
    } catch {
      /* skip */
    }
  }
  return "";
}

function pickLinkedIn(urls: string[]): string {
  return pickFirstUrlForHost(urls, "linkedin.com");
}

function pickInstagram(urls: string[]): string {
  return pickFirstUrlForHost(urls, "instagram.com");
}

function pickFacebook(urls: string[]): string {
  for (const raw of urls) {
    try {
      const u = new URL(raw);
      const h = hostnameNorm(u.hostname);
      if (!h.endsWith("facebook.com") && !h.endsWith("fb.com")) continue;
      const path = u.pathname.toLowerCase();
      if (path === "/" || path.startsWith("/login") || path.startsWith("/policy")) continue;
      return raw;
    } catch {
      /* skip */
    }
  }
  return "";
}

export type SerpSocialProfilesFromDfs = {
  linkedinUrl: string;
  instagramUrl: string;
  facebookUrl: string;
};

/**
 * Generic SERP + Google `site:` queries on LinkedIn, Instagram, and Facebook (DataForSEO organic live).
 * Deduplicates organic URLs for the model; picks first matching profile URL per network from respective SERPs.
 */
export async function fetchCitationSerpBundle(args: {
  businessName: string;
  websiteUrl: string;
  signal?: AbortSignal;
}): Promise<{
  serpOrganicUrls: string[];
  serpSocialFromDfs: SerpSocialProfilesFromDfs;
}> {
  const host = hostFromWebsiteUrl(args.websiteUrl);
  const name = args.businessName.trim() || host || "business";
  const web = args.websiteUrl.trim();
  const location_name = inferDataForSeoLocationNameFromWebsiteUrl(args.websiteUrl);

  /** Broad discovery (same idea as before: short query). */
  const genericKeyword =
    [name, host || web, "social"].filter(Boolean).join(" ").trim() || web || name;

  const quoted = name.includes('"') ? name : `"${name}"`;

  const [genericUrls, liUrls, igUrls, fbUrls] = await Promise.all([
    postSerpOrganic({
      keyword: genericKeyword,
      location_name,
      depth: 15,
      signal: args.signal,
    }),
    postSerpOrganic({
      keyword: `${quoted} site:linkedin.com`,
      location_name,
      depth: 10,
      signal: args.signal,
    }),
    postSerpOrganic({
      keyword: `${quoted} site:instagram.com`,
      location_name,
      depth: 10,
      signal: args.signal,
    }),
    postSerpOrganic({
      keyword: `${quoted} site:facebook.com`,
      location_name,
      depth: 10,
      signal: args.signal,
    }),
  ]);

  const serpSocialFromDfs: SerpSocialProfilesFromDfs = {
    linkedinUrl: pickLinkedIn(liUrls),
    instagramUrl: pickInstagram(igUrls),
    facebookUrl: pickFacebook(fbUrls),
  };

  const merged = [...genericUrls, ...liUrls, ...igUrls, ...fbUrls];
  const serpOrganicUrls = [...new Set(merged)].slice(0, 48);

  return { serpOrganicUrls, serpSocialFromDfs };
}

/** @deprecated Use fetchCitationSerpBundle and pass serpOrganicUrls */
export async function fetchSerpOrganicUrlsForCitation(args: {
  businessName: string;
  websiteUrl: string;
  signal?: AbortSignal;
}): Promise<string[]> {
  const { serpOrganicUrls } = await fetchCitationSerpBundle(args);
  return serpOrganicUrls;
}
