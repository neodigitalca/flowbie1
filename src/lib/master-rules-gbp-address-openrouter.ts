/**
 * OpenRouter: DataForSEO google_my_business_info JSON → GBP address object for Master Rules.
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { getGoogleBusinessInfoItem } from "@/lib/gmb-dfs-parse";
export type GbpAddressMasterRulesPayload = {
  source: "dataforseo_google_my_business_info";
  fetchedAt: string;
  businessName: string;
  formattedAddress: string;
  city: string;
  region: string;
  countryCode?: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  cid: string | null;
};

const MAX_JSON_CHARS = 28_000;
const ADDRESS_JSON_MAX_TOKENS = 2048;

function compactGmbPayload(gmbJson: unknown): string {
  const item = getGoogleBusinessInfoItem(gmbJson);
  const payload = item ?? gmbJson;
  try {
    const s = JSON.stringify(payload);
    return s.length > MAX_JSON_CHARS ? `${s.slice(0, MAX_JSON_CHARS)}…` : s;
  } catch {
    return String(payload);
  }
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function strOrEmpty(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(v: unknown): string | null {
  const s = strOrEmpty(v);
  return s || null;
}

/** Validate model JSON without regex. */
export function parseGbpAddressFromOpenRouterContent(
  content: string,
): Omit<GbpAddressMasterRulesPayload, "source" | "fetchedAt"> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const businessName = strOrEmpty(o.businessName);
  const formattedAddress = strOrEmpty(o.formattedAddress);
  const city = strOrEmpty(o.city);
  const region = strOrEmpty(o.region);
  const phone = strOrEmpty(o.phone);

  const out: Omit<GbpAddressMasterRulesPayload, "source" | "fetchedAt"> = {
    businessName,
    formattedAddress,
    city,
    region,
    phone,
    latitude: numOrNull(o.latitude),
    longitude: numOrNull(o.longitude),
    placeId: strOrNull(o.placeId),
    cid: strOrNull(o.cid),
  };
  const cc = strOrEmpty(o.countryCode);
  if (cc.length >= 2) out.countryCode = cc.slice(0, 2).toUpperCase();
  return out;
}

export async function extractGbpAddressMasterRulesJsonOpenRouter(args: {
  apiKey: string;
  model: string;
  gmbJson: unknown;
  siteUrl: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const blob = compactGmbPayload(args.gmbJson);

  const system = `You read Google Business Profile data from DataForSEO (JSON). Reply with a single JSON object only, no markdown.
Required shape:
{
  "businessName": "<string>",
  "formattedAddress": "<full street line if present>",
  "city": "<string>",
  "region": "<state or province>",
  "countryCode": "<ISO 3166-1 alpha-2 when known>",
  "phone": "<string>",
  "latitude": <number or null>,
  "longitude": <number or null>,
  "placeId": "<string or null>",
  "cid": "<string or null>"
}
Use only fields present in the JSON. Do not invent addresses. If the payload has no usable business location, return {"businessName":"","formattedAddress":"","city":"","region":"","phone":"","latitude":null,"longitude":null,"placeId":null,"cid":null}.`;

  const user = `Website context: ${args.siteUrl}

DataForSEO google_my_business_info JSON:
${blob}`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    maxTokens: ADDRESS_JSON_MAX_TOKENS,
    signal: args.signal,
    temperature: Math.min(REPORT_TEMPERATURE, 0.2),
    responseFormat: { type: "json_object" },
  });

  const fields = parseGbpAddressFromOpenRouterContent(content);
  if (!fields) return null;

  const payload: GbpAddressMasterRulesPayload = {
    source: "dataforseo_google_my_business_info",
    fetchedAt: new Date().toISOString(),
    ...fields,
  };
  return JSON.stringify(payload, null, 2);
}
