import { extractFirstBalancedJsonValue } from "@/lib/competitor-research/competitor-report-json-parse";

export type LegacyRedirectMatchProposal = {
  legacyUrl: string;
  destinationUrl: string;
};

function stripMarkdownFence(raw: string): string {
  const t = raw.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1]!.trim() : t;
}

function normalizeMatches(list: unknown[]): LegacyRedirectMatchProposal[] {
  const out: LegacyRedirectMatchProposal[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const legacyUrl = typeof p.legacyUrl === "string" ? p.legacyUrl.trim() : "";
    const destinationUrl =
      typeof p.destinationUrl === "string"
        ? p.destinationUrl.trim()
        : typeof p.matchedBlogUrl === "string"
          ? p.matchedBlogUrl.trim()
          : "";
    if (!legacyUrl || !destinationUrl) continue;
    out.push({ legacyUrl, destinationUrl });
  }
  return out;
}

export function parseLegacyRedirectMatchAgentJson(content: string): LegacyRedirectMatchProposal[] {
  const trimmed = stripMarkdownFence(content ?? "");
  if (!trimmed) {
    throw new Error("Gemini returned empty response.");
  }

  const jsonSlice = extractFirstBalancedJsonValue(trimmed) ?? trimmed;
  if (!jsonSlice.trim()) {
    throw new Error("Gemini response contained no JSON.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonSlice);
  } catch {
    throw new Error("Gemini response was not valid JSON.");
  }

  if (Array.isArray(raw)) {
    return normalizeMatches(raw);
  }

  if (raw && typeof raw === "object") {
    const obj = raw as { matches?: unknown[]; rows?: unknown[] };
    const list = obj.matches ?? obj.rows;
    if (!Array.isArray(list)) {
      throw new Error("Gemini JSON missing matches array.");
    }
    const matches = normalizeMatches(list);
    return matches;
  }

  throw new Error("Gemini JSON shape was not recognized.");
}

export function parseLegacyRedirectExtractAgentJson(content: string): string[] {
  const trimmed = stripMarkdownFence(content ?? "");
  if (!trimmed) {
    throw new Error("Gemini returned empty response.");
  }

  const jsonSlice = extractFirstBalancedJsonValue(trimmed) ?? trimmed;
  if (!jsonSlice.trim()) {
    throw new Error("Gemini response contained no JSON.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonSlice);
  } catch {
    throw new Error("Gemini response was not valid JSON.");
  }

  if (!raw || typeof raw !== "object") {
    throw new Error("Gemini JSON shape was not recognized.");
  }

  const list = (raw as { legacyUrls?: unknown }).legacyUrls;
  if (!Array.isArray(list)) {
    throw new Error("Gemini JSON missing legacyUrls array.");
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const url = item.trim();
    if (!url) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }

  if (!out.length) {
    throw new Error("Gemini returned an empty legacyUrls array.");
  }

  return out;
}
