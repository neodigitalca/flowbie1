/**
 * OpenRouter json_object pass maps DataForSEO + site context into CitationRecord, then empty fields
 * are filled from parsed `google_business_info` and business listing rows (DataForSEO API shapes).
 */

import { z } from "zod";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import type { WordPressSite } from "@/components/integrations/types";
import type { BusinessListingItem } from "@/lib/citation-research/dfs-business-listings-client";
import type { CitationRecord } from "@/lib/citation-research/citation-from-gmb-item";
import type { SerpSocialProfilesFromDfs } from "@/lib/citation-research/citation-serp-social";
import {
  applySerpSocialOverridesFromDfs,
  buildCitationDfsPartials,
  mergeCitationRecordWithDfsPartials,
} from "@/lib/citation-research/citation-merge-from-dfs";
import { getPrimaryCityStateLabel } from "@/lib/primary-location-from-site";

const MAX_USER_MESSAGE_CHARS = 90_000;

function emptyCitationRecord(): CitationRecord {
  return {
    businessName: "",
    address: "",
    phone: "",
    websiteUrl: "",
    gmbUrl: "",
    description: "",
    keywords: "",
    logoWide: "",
    logoSquare: "",
    instagramUrl: "",
    linkedinUrl: "",
    facebookUrl: "",
    discoveredUrls: "",
    hourMonday: "",
    hourTuesday: "",
    hourWednesday: "",
    hourThursday: "",
    hourFriday: "",
    hourSaturday: "",
    hourSunday: "",
  };
}

function strFromUnknown(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  return String(v).trim();
}

const citationRecordSchema = z
  .object({
    businessName: z.unknown().optional(),
    address: z.unknown().optional(),
    phone: z.unknown().optional(),
    websiteUrl: z.unknown().optional(),
    gmbUrl: z.unknown().optional(),
    description: z.unknown().optional(),
    keywords: z.unknown().optional(),
    logoWide: z.unknown().optional(),
    logoSquare: z.unknown().optional(),
    instagramUrl: z.unknown().optional(),
    linkedinUrl: z.unknown().optional(),
    facebookUrl: z.unknown().optional(),
    discoveredUrls: z.unknown().optional(),
    hourMonday: z.unknown().optional(),
    hourTuesday: z.unknown().optional(),
    hourWednesday: z.unknown().optional(),
    hourThursday: z.unknown().optional(),
    hourFriday: z.unknown().optional(),
    hourSaturday: z.unknown().optional(),
    hourSunday: z.unknown().optional(),
  })
  .passthrough();

function normalizeRecord(p: z.infer<typeof citationRecordSchema>): CitationRecord {
  const e = emptyCitationRecord();
  for (const k of Object.keys(e) as (keyof CitationRecord)[]) {
    e[k] = strFromUnknown(p[k as keyof typeof p]);
  }
  return e;
}

export function truncateCitationContextJson(payload: unknown): string {
  const raw = JSON.stringify(payload);
  if (raw.length <= MAX_USER_MESSAGE_CHARS) return raw;
  return `${raw.slice(0, MAX_USER_MESSAGE_CHARS)}\n\n[CONTEXT_TRUNCATED]`;
}

const SYSTEM = `You extract a local business citation for directory use. Reply with a single JSON object only, no markdown.

Rules:
- Every string value must be grounded in the provided JSON payloads or connectedSite fields. If a fact does not appear in the input, use an empty string "" for that key. Do not invent phone numbers, addresses, brands, or URLs.
- For Maps/GBP profile URLs (gmbUrl): only include a URL if it appears in the DataForSEO responses (google_business_info item or business listing row). Never fabricate google.com/maps search links.
- description: one polished paragraph (2–5 sentences), factual to the evidence only.
- keywords: comma-separated phrases, 8–14 items, no hashtags.
- discoveredUrls: newline-separated http(s) URLs taken from serpOrganicUrls (includes DataForSEO Google organic results for generic + site:linkedin/instagram/facebook) and/or evident profile URLs in the payloads; omit lines you cannot support from input.
- instagramUrl, linkedinUrl, facebookUrl: use serpSocialFromDfs when present; otherwise evidence from google_business_info local_business_links only.
- hourMonday … hourSunday: exactly one time range (or "Closed") per field - e.g. hourMonday is only Monday's hours, without repeating day names. Never put multiple days in one field and never output "Monday: … Tuesday: …" as a single run-on line; use separate keys for each day.

Required JSON keys exactly: businessName, address, phone, websiteUrl, gmbUrl, description, keywords, logoWide, logoSquare, instagramUrl, linkedinUrl, facebookUrl, discoveredUrls, hourMonday, hourTuesday, hourWednesday, hourThursday, hourFriday, hourSaturday, hourSunday.`;

export type CitationExtractionPayload = {
  connectedSite: {
    siteUrl: string;
    displayName: string;
    napName: string;
    napPhone: string;
    primaryCityLabel: string;
  };
  businessListingsSearchResponse: unknown;
  googleBusinessInfoLiveResponse: unknown | null;
  pickedBusinessListingRow: BusinessListingItem | null;
  serpOrganicUrls: string[];
  /** First organic hit per network from DataForSEO SERP with site:linkedin.com | site:instagram.com | site:facebook.com */
  serpSocialFromDfs: SerpSocialProfilesFromDfs;
  seedKeyword?: string;
};

export async function extractCitationRecordWithOpenRouter(args: {
  apiKey: string;
  model: string;
  site: WordPressSite;
  businessListingsSearchResponse: unknown;
  googleBusinessInfoLiveResponse: unknown | null;
  pickedBusinessListingRow: BusinessListingItem | null;
  serpOrganicUrls: string[];
  serpSocialFromDfs: SerpSocialProfilesFromDfs;
  seedKeyword?: string;
  signal?: AbortSignal;
}): Promise<CitationRecord> {
  const city = getPrimaryCityStateLabel(args.site) ?? "";
  const payload: CitationExtractionPayload = {
    connectedSite: {
      siteUrl: args.site.siteUrl.trim(),
      displayName: args.site.name.trim(),
      napName: args.site.napInfo?.name?.trim() ?? "",
      napPhone: args.site.napInfo?.phone?.trim() ?? "",
      primaryCityLabel: city,
    },
    businessListingsSearchResponse: args.businessListingsSearchResponse,
    googleBusinessInfoLiveResponse: args.googleBusinessInfoLiveResponse,
    pickedBusinessListingRow: args.pickedBusinessListingRow,
    serpOrganicUrls: args.serpOrganicUrls,
    serpSocialFromDfs: args.serpSocialFromDfs,
    seedKeyword: args.seedKeyword?.trim() || undefined,
  };

  const user = `Extract the citation JSON from this context:\n${truncateCitationContextJson(payload)}`;

  const maxTokens = getCompetitorReportMaxOutputTokens(args.model);
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: SYSTEM,
    user,
    maxTokens,
    signal: args.signal,
    temperature: 0.25,
    responseFormat: { type: "json_object" },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim()) as unknown;
  } catch {
    throw new Error("Citation extraction: model returned non-JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Citation extraction: expected a JSON object");
  }

  const zod = citationRecordSchema.safeParse(parsed);
  if (!zod.success) {
    throw new Error("Citation extraction: JSON did not match expected shape");
  }

  const fromModel = normalizeRecord(zod.data);
  const dfsPartials = buildCitationDfsPartials({
    googleBusinessInfoLiveResponse: args.googleBusinessInfoLiveResponse,
    pickedBusinessListingRow: args.pickedBusinessListingRow,
    site: args.site,
  });
  const merged = mergeCitationRecordWithDfsPartials(fromModel, ...dfsPartials);
  return applySerpSocialOverridesFromDfs(merged, args.serpSocialFromDfs);
}
