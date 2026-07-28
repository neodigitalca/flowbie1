import { getResearchModel } from "../optimization-settings-storage";
import { fetchWikipediaIntroPlainText } from "./mediawiki-intro";
import { getLinksFromWikipediaPage } from "./wiki-links-lists";

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/** Structural check only - no geography lists or regex-based place names. */
function looksLikeSapEntityLabel(s: string): boolean {
  const t = s.trim();
  if (t.length < 4 || t.length > 200) return false;
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2;
}

export type PickSapGeographicEntityFromWikipediaParams = {
  apiKey: string;
  /** Per-site research model when omitted uses `getResearchModel(siteId)`. */
  model?: string;
  siteId?: string;
  /** Resolved English Wikipedia article title for the neighborhood / place page. */
  parentArticleTitle: string;
  /** Current SAP entity string; used as fallback and for context. */
  originalEntity: string;
};

/**
 * After a Wikipedia article is selected for a row, use OpenRouter to read the **lead** and **outgoing
 * link titles** (MediaWiki API only for text/links - no hardcoded metro lists) and return one
 * geographic SAP `entity` label, preferring a **linked** real place (parent area, district, corridor, etc.).
 * Excludes organizations (leagues, federations, clubs, …) by instruction, not by regex location tables.
 */
export async function pickSapGeographicEntityFromWikipediaArticle(
  params: PickSapGeographicEntityFromWikipediaParams
): Promise<{ entity: string | null }> {
  const { apiKey, siteId, parentArticleTitle, originalEntity } = params;
  const title = parentArticleTitle.trim();
  if (!title || !apiKey.trim()) return { entity: null };

  const model = params.model?.trim() || getResearchModel(siteId);

  const [intro, links] = await Promise.all([
    fetchWikipediaIntroPlainText(title, 2200),
    getLinksFromWikipediaPage(title, { limit: 140 }),
  ]);

  if (!intro.trim() && links.length === 0) return { entity: null };

  const linkBlock =
    links.length > 0
      ? links
          .slice(0, 100)
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")
      : "(no outgoing links retrieved)";

  const system = `You output ONLY valid JSON: {"entity":"..."} or {"entity":null}.

You are refining a **local SEO "entity"** line for a bulk CSV: **two or three comma-separated segments**:
(1) **Hyperlocal** name of a place where **people live, work, or identify as a local community** - neighbourhood, suburb, district, town quarter, historic district, urban village, main-street area, or a **community-anchoring landmark** only when it functions as a **local place name** (e.g. downtown, civic core);
(2) **City** or **primary locality** name;
(3) Optional **province/state** abbreviation when helpful.

**Prefer** segment (1) from the **outgoing link titles** when one clearly names such a **human-community** place that **relates** to the article (parent district, adjacent neighbourhood, CDP, incorporated place named in the lead).
If the **subject article** is **not** a community place (e.g. archaeological site, paleontology dig, remote wilderness, sports federation), **follow links** to the nearest **incorporated place, CDP, neighbourhood, or historic district** and use that for segment (1).

**Do not** use as segment (1): archaeological or prehistoric **sites**, dig sites, remote natural parks as the primary label, sports leagues, civic federations, school boards, companies, or other **non-place** topics - even if they appear as links.
**Do not** output a "List of …" index as the entity. **Do not** invent street numbers or postal codes.

If you cannot name a **clearer community-focused** label than the original (or nothing fits), return {"entity":null}.`;

  const user = `Wikipedia article (subject page) title: "${title}"

Original SAP entity (use only as context; return null if you cannot improve): "${originalEntity.trim()}"

--- Article lead (plain text) ---
${intro.slice(0, 2600)}

--- Outgoing article titles (from this page; geographic links preferred for segment 1) ---
${linkBlock}

Return JSON only: {"entity":"Hyperlocal, City, ST"} or {"entity":null}.`;

  const { streamChatCompletion } = await import("../api");
  let raw = "";
  await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.12,
    maxTokens: 400,
    topP: 0.9,
    onContentChunk: (c) => {
      raw += c;
    },
  });

  const cleaned = stripJsonFence(raw);
  let entity: string | null = null;
  try {
    const obj = JSON.parse(cleaned) as { entity?: unknown };
    const e = obj.entity;
    if (e !== null && e !== undefined && String(e).trim() !== "") {
      const s = String(e).trim();
      if (looksLikeSapEntityLabel(s)) entity = s;
    }
  } catch {
    /* keep null */
  }

  return { entity };
}
