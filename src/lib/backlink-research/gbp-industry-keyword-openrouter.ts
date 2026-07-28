/**
 * OpenRouter: DataForSEO GBP (google my business info live) JSON → one industry niche phrase for SERP.
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { getGoogleBusinessInfoItem } from "@/lib/gmb-dfs-parse";

const MAX_JSON_CHARS = 24_000;
const INDUSTRY_JSON_MAX_TOKENS = 1024;

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

function dedupeKeywords(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const k = raw.trim();
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out.slice(0, 12);
}

/**
 * Returns several niche phrases (e.g. "emergency dental", "residential HVAC") for the user to pick one for SERP.
 */
export async function extractIndustryKeywordsFromGmbOpenRouter(args: {
  apiKey: string;
  model: string;
  gmbJson: unknown;
  siteUrl: string;
  signal?: AbortSignal;
}): Promise<string[]> {
  const blob = compactGmbPayload(args.gmbJson);

  const system = `You read Google Business Profile data returned by DataForSEO (JSON). Reply with a single JSON object only, no markdown outside JSON.
Shape: { "industryKeywords": ["<string>", ...] }
Return 5 to 8 distinct short niche or industry phrases (each about two to five words) suitable for finding "write for us" guest post opportunities. Prefer service categories (e.g. residential roofing, family law). Omit city, state, and brand name from every phrase. Order most relevant first.
If the JSON is empty or unusable, return { "industryKeywords": [] }.
Legacy: you may also output { "industryKeyword": "<one string>" }; if industryKeywords is empty but industryKeyword is set, the client will treat it as a one-element list.`;

  const user = `Website: ${args.siteUrl}

GBP JSON:
${blob}`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    maxTokens: INDUSTRY_JSON_MAX_TOKENS,
    signal: args.signal,
    temperature: Math.min(REPORT_TEMPERATURE, 0.25),
    responseFormat: { type: "json_object" },
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim());
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];

  const o = parsed as { industryKeywords?: unknown; industryKeyword?: unknown };
  let list: string[] = [];
  if (Array.isArray(o.industryKeywords)) {
    for (const x of o.industryKeywords) {
      if (typeof x === "string" && x.trim()) list.push(x.trim());
    }
  }
  if (list.length === 0 && typeof o.industryKeyword === "string" && o.industryKeyword.trim()) {
    list = [o.industryKeyword.trim()];
  }
  return dedupeKeywords(list);
}

/**
 * Returns a short phrase for guest-post style search (first suggestion from the multi-keyword helper).
 */
export async function extractIndustryKeywordFromGmbOpenRouter(args: {
  apiKey: string;
  model: string;
  gmbJson: unknown;
  siteUrl: string;
  signal?: AbortSignal;
}): Promise<string> {
  const kws = await extractIndustryKeywordsFromGmbOpenRouter(args);
  return kws[0] ?? "";
}
