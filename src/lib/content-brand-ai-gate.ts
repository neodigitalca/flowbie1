/**
 * AI brand / blocked-topic gate (OpenRouter).
 * Narrow rejects only: own trading name (fuzzy) + permanent blocked topics (e.g. Bali Blinds).
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { GLOBAL_BLOCKED_TOPIC_PHRASES } from "@/lib/content-topic-blocklist";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";

/** Human labels for permanent topic bans (AI decides fuzzy matches). */
export const AI_BLOCKED_TOPIC_LABELS: string[] = [
  ...new Set(
    GLOBAL_BLOCKED_TOPIC_PHRASES.map((p) =>
      p
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    ),
  ),
  "Bali Blinds",
];

const SYSTEM = `You are a narrow brand/topic gate for SEO focus keywords and titles.

Default: KEEP. Only REJECT when clearly wrong.

REJECT only when the candidate is primarily:
1. The site's own trading / company name from siteName (navigational brand search) — fuzzy, word-reorder, or brand+city count.
   Examples for site "Blind Magic Window Coverings | Hunter Douglas Blinds":
   REJECT: "blind magic", "magic blinds", "blind magic edmonton", "Magic Blinds Available In Edmonton".
2. A blockedTopics entry or clear variant (e.g. Bali Blinds → "bali blinds", "bali blind removal").

KEEP (do NOT reject) all of these:
- Product / service + place: "custom blinds edmonton", "blind repair edmonton", "blinds edmonton", "roman shades edmonton"
- Manufacturer / product-line brands the dealer sells (Hunter Douglas, Alta, PowerView, etc.) — KEEP "hunter douglas edmonton", "alta roller shades edmonton"
- Anything that only shares a generic product word (blinds, shades, windows) with the company name
- When unsure: KEEP

Return ONLY JSON: {"reject":["..."]}
- List ONLY candidates that must be rejected (expect few or none).
- Each reject entry MUST be copied EXACTLY from the input candidates array.
- If none reject: {"reject":[]}`;

type GateResponse = { reject?: unknown };

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns the subset of `candidates` that the model rejects as own-brand / blocked topic.
 * Empty input or missing credentials → no rejects.
 */
export async function aiRejectBrandOrBlockedTexts(args: {
  apiKey: string;
  model: string;
  companyName: string;
  candidates: string[];
  kind: "keyword" | "title";
  blockedTopics?: string[];
}): Promise<string[]> {
  const apiKey = args.apiKey.trim();
  const companyName = args.companyName.trim();
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of args.candidates) {
    const t = raw.trim();
    if (!t) continue;
    const key = normKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(t);
  }
  if (!apiKey || !companyName || unique.length === 0) return [];

  const blockedTopics = (args.blockedTopics?.length ? args.blockedTopics : AI_BLOCKED_TOPIC_LABELS)
    .map((t) => t.trim())
    .filter(Boolean);

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: args.model,
    system: SYSTEM,
    user: JSON.stringify({
      kind: args.kind,
      siteName: companyName,
      blockedTopics,
      candidates: unique,
    }),
    maxTokens: Math.min(4096, Math.max(256, unique.length * 40)),
    temperature: 0,
    responseFormat: { type: "json_object" },
  });

  const { parsed } = parseJsonWithRepair<GateResponse>(content, {
    targetKeys: ["reject"],
    fallback: { reject: [] },
  });
  const rejectList = Array.isArray(parsed.reject) ? parsed.reject : [];
  const rejectKeys = new Set<string>();
  for (const item of rejectList) {
    if (typeof item !== "string") continue;
    const key = normKey(item);
    if (key) rejectKeys.add(key);
  }
  return unique.filter((t) => rejectKeys.has(normKey(t)));
}

/** Keep only candidates the AI does not reject. */
export async function aiFilterAllowedBrandTexts(args: {
  apiKey: string;
  model: string;
  companyName: string;
  candidates: string[];
  kind: "keyword" | "title";
  blockedTopics?: string[];
}): Promise<string[]> {
  const trimmed = args.candidates.map((c) => c.trim()).filter(Boolean);
  if (trimmed.length === 0) return [];
  const rejected = await aiRejectBrandOrBlockedTexts(args);
  if (rejected.length === 0) return trimmed;
  const rejectKeys = new Set(rejected.map(normKey));
  return trimmed.filter((c) => !rejectKeys.has(normKey(c)));
}
