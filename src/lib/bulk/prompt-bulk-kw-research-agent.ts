import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { aiFilterAllowedBrandTexts } from "@/lib/content-brand-ai-gate";
import { GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK } from "@/lib/content-topic-blocklist";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { getResearchModel } from "@/lib/optimization-settings-storage";

const SYSTEM = `You are a blog keyword research agent.

You MUST read SITE_KW_JSON first. It contains Semrush and GSC keyword lists for the target site.
Metrics were already used locally to sort the lists, then removed to save tokens.
Prioritize Semrush first, then use GSC as secondary support.

Read CONNECTED_SITE. Infer market jurisdiction only from that data (name, URL, NAP city/state). Never invent an unrelated market. Never assume a hardcoded country.

Goal: return exactly numberOfBlogs blog keywords when enough unique usable ones exist in the lists.

${GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK}

Selection rules:
- Source first: each keyword MUST be derived from an entry in the lists. Only invent a new keyword when the lists cannot supply enough unique usable ones.
- Prefer earlier Semrush entries first, then earlier GSC entries (already sorted by opportunity).
- Keep only informational and transactional intent. Drop navigational and branded queries.
- **NEVER return the CONNECTED_SITE trading / company name** (fuzzy / word-reorder — e.g. "Blind Magic" ↔ "Magic Blinds"). Keep product/service keywords and dealer product lines (Hunter Douglas, Alta, etc.).
- Distill long-tail or question phrases into complete short-tail intent keywords. Do NOT truncate mechanically. Remove question wrappers like "how much does", "how much do", "what is", "where to", "can I", and keep the full product/service + intent core.
- Examples: "how much do solar panels cost in alberta" -> "solar panels cost"; "how much does it cost to install solar panels" -> "solar panel installation cost"; "how much is solar energy" -> "solar energy cost". Bad: "how much do solar energy", "how much do solar panels", "cost of solar panels edmonton".
- Two geo paths (understand meaning; do not pattern-match):
  1. Local / near-me / installer-in-city / service-proximity: trim city, neighborhood, "near me", and similar. Keep product/service + intent only. Short-tail: 2-3 words.
  2. Government / policy / incentives / grants / rebates / regulations / tax credits: ALWAYS include jurisdiction. Infer country (and federal vs provincial/state when the query clearly needs it) from CONNECTED_SITE only. Good: "federal solar incentives canada". Bad: "solar incentives" (missing jurisdiction). Allow 3-5 words when jurisdiction is required.
- Unique only: no duplicates and no two keywords that target the same search intent (no cannibalization). Merge near-duplicates into one.
- If topic is provided, every keyword must fit that topic; otherwise trim or replace it.
- Return at most numberOfBlogs keywords. Return [] when the JSON has no useful data.

Return only JSON: {"keywords":["..."]}.`;

type AgentResponse = {
  keywords?: unknown;
};

export type PromptBulkKwConnectedSiteContext = {
  name: string;
  siteUrl: string;
  city?: string;
  state?: string;
};

function cleanKeyword(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function parseKeywords(raw: string, limit: number): string[] {
  try {
    const { parsed } = parseJsonWithRepair<AgentResponse>(raw, {
      targetKeys: ["keywords"],
      fallback: { keywords: [] },
    });
    if (!Array.isArray(parsed.keywords)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed.keywords) {
      const keyword = cleanKeyword(item);
      if (!keyword) continue;
      const key = keyword.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(keyword);
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function buildPromptBulkKwConnectedSiteContext(site: {
  name?: string;
  siteUrl?: string;
  locations?: Array<{ city?: string; state?: string; isDefault?: boolean }>;
  napInfo?: { locations?: Array<{ city?: string; state?: string; isDefault?: boolean }> };
}): PromptBulkKwConnectedSiteContext | null {
  const name = typeof site.name === "string" ? site.name.trim() : "";
  const siteUrl = typeof site.siteUrl === "string" ? site.siteUrl.trim() : "";
  if (!name && !siteUrl) return null;

  const locs = [
    ...(Array.isArray(site.locations) ? site.locations : []),
    ...(Array.isArray(site.napInfo?.locations) ? site.napInfo.locations : []),
  ];
  const preferred = locs.find((l) => l?.isDefault) ?? locs[0];
  const city = typeof preferred?.city === "string" ? preferred.city.trim() : "";
  const state = typeof preferred?.state === "string" ? preferred.state.trim() : "";

  return {
    name: name || siteUrl,
    siteUrl: siteUrl || name,
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
  };
}

export async function selectPromptBulkLowHangingKeywords(args: {
  apiKey: string;
  siteId?: string;
  keywordsJsonText: string;
  numberOfBlogs: number;
  topic?: string;
  modifier?: string;
  inventoryUrlCount?: number | null;
  connectedSite?: PromptBulkKwConnectedSiteContext | null;
}): Promise<string[]> {
  const apiKey = args.apiKey.trim();
  const limit = Math.max(1, Math.min(50, Math.floor(args.numberOfBlogs) || 1));
  const jsonText = args.keywordsJsonText.trim();
  if (!apiKey || !jsonText) return [];

  try {
    const user = JSON.stringify({
      numberOfBlogs: limit,
      topic: args.topic?.trim() || "",
      modifier: args.modifier?.trim() || "",
      inventoryUrlCount: args.inventoryUrlCount ?? null,
      CONNECTED_SITE: args.connectedSite ?? null,
      SITE_KW_JSON: JSON.parse(jsonText) as unknown,
    });

    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model: getResearchModel(args.siteId),
      system: SYSTEM,
      user,
      maxTokens: Math.min(2048, Math.max(512, limit * 80)),
      temperature: 0.25,
      responseFormat: { type: "json_object" },
    });

    const parsed = parseKeywords(content, limit * 2);
    const companyName = args.connectedSite?.name?.trim() || "";
    if (!companyName) return parsed.slice(0, limit);
    const allowed = await aiFilterAllowedBrandTexts({
      apiKey,
      model: getResearchModel(args.siteId),
      companyName,
      candidates: parsed,
      kind: "keyword",
    });
    return allowed.slice(0, limit);
  } catch {
    return [];
  }
}
