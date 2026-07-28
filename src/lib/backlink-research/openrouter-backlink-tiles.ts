/**
 * OpenRouter: SERP digest → JSON tiles (url, summary, optional pursue).
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";

export type BacklinkTile = {
  url: string;
  summary: string;
  pursue?: string;
  /** Organic SERP title from DataForSEO (stand-in for page title before on-page parse). */
  serpTitle?: string;
};

/** Lower = higher priority (yes first, then maybe, skip, unknown). */
export function pursueSortRank(pursue: string | undefined): number {
  const p = pursue?.trim().toLowerCase() ?? "";
  if (!p) return 3;
  if (/^yes\b/.test(p)) return 0;
  if (/^maybe\b/.test(p)) return 1;
  if (/^skip\b/.test(p)) return 2;
  if (/\byes\b/.test(p) && !/\bmaybe\b/.test(p)) return 0;
  if (/\bmaybe\b/.test(p)) return 1;
  if (/\bskip\b/.test(p)) return 2;
  return 3;
}

/** After SERP: best-fit placements first (stable for ties). */
export function sortBacklinkTilesByPriority(tiles: BacklinkTile[]): BacklinkTile[] {
  return [...tiles].sort((a, b) => pursueSortRank(a.pursue) - pursueSortRank(b.pursue));
}

const TILES_JSON_MAX_TOKENS = 8192;

function stripJsonFence(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    const withoutOpen = t.replace(/^```(?:json)?\s*/i, "");
    return withoutOpen.replace(/\s*```\s*$/i, "").trim();
  }
  return t;
}

function parseTilesJson(content: string): BacklinkTile[] {
  const raw = stripJsonFence(content);
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return [];
  const tiles = (parsed as { tiles?: unknown }).tiles;
  if (!Array.isArray(tiles)) return [];
  const out: BacklinkTile[] = [];
  for (const item of tiles) {
    if (!item || typeof item !== "object") continue;
    const o = item as { url?: unknown; summary?: unknown; pursue?: unknown };
    const url = typeof o.url === "string" ? o.url : "";
    const summary = typeof o.summary === "string" ? o.summary : "";
    if (!url.trim()) continue;
    const t: BacklinkTile = { url: url.trim(), summary: summary.trim() };
    if (typeof o.pursue === "string" && o.pursue.trim()) t.pursue = o.pursue.trim();
    out.push(t);
  }
  return out;
}

export async function analyzeBacklinkTiles(args: {
  apiKey: string;
  model: string;
  serpDigest: string;
  industry: string;
  siteUrl?: string;
  siteName?: string;
  signal?: AbortSignal;
}): Promise<BacklinkTile[]> {
  const siteLine =
    args.siteUrl?.trim() || args.siteName?.trim()
      ? `Site context: ${args.siteName?.trim() || ""} ${args.siteUrl?.trim() || ""}`.trim()
      : "Site context: not provided.";

  const system = `You help SEOs evaluate guest post and contributor opportunities from Google organic SERP lines.
Return a single JSON object only, no markdown outside JSON. Shape: { "tiles": [ { "url", "summary", "pursue" } ] }.
Each tile must use a url from the digest. "summary" is one or two short sentences: what the page likely is and any hint from the snippet. "pursue" is optional: "yes", "maybe", or "skip" plus a very short reason if useful.
Do not invent URLs not present in the digest.`;

  const user = `Industry focus: ${args.industry}

${siteLine}

SERP digest:
${args.serpDigest}`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    maxTokens: TILES_JSON_MAX_TOKENS,
    signal: args.signal,
    temperature: Math.min(REPORT_TEMPERATURE, 0.25),
    responseFormat: { type: "json_object" },
  });

  try {
    return parseTilesJson(content);
  } catch {
    return [];
  }
}
