import { appendMasterInstructionsToSystemPrompt, ensureMasterInstructionsInMemory } from "../master-instructions-storage";
import { getResearchModel } from "../optimization-settings-storage";

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

const SYS_FILTER = `You filter English Wikipedia article titles for **local SEO entity mapping**. The business serves **today's customers** in real service areas: we need **geographic places** - where people **live, work, shop, travel through, or drive for appointments** - neighbourhoods, suburbs, towns, CDPs, named districts, main streets, commercial corridors, urban villages, parks, **airports**, bridges, civic **buildings** and **landmarks**, natural features **within** the service area.

Reply with ONLY valid JSON: {"kept":["Title1","Title2",...]} - a **subset** of the input titles, **preserving the same order** as listed in the user message.

**Always drop** (never keep):
- **Sports teams and clubs** at any level (NHL, NFL, CFL, NBA, MLB, MLS, soccer, college teams, junior hockey, etc.) - e.g. city + "Jets", "Blue Bombers", "Raptors", "Roughriders"
- **Newspapers, magazines, TV/radio stations, broadcasters, publishers** (e.g. "* Free Press", "* Times" as the news organization - not a street named after a paper)
- **Companies, brands, retail chains, NGOs, unions, festivals-as-entities** when the article is the org - not a named district or building used as a place label
- **Medical practices, clinics, hospitals, and org pages** named like "**City Sports Medicine**" or "**Something Prenatal Care**" - the clinic business, **not** a neighbourhood or civic geography (drop those; prefer district/street/neighbourhood articles instead)
- **Archaeology / prehistory:** dig sites, prehistoric **cultures**, **earthworks** as excavation topics (not a modern district name)
- Titles ending in **" Site"** when they denote **archaeological or NRHP dig** (not a retail corridor)
- **MPS**, **NRHP** documentation pages when the subject is paperwork, not a visitable place label
- Sports **governing federations** (non-place), civic **federations** as organizations
- Remote wilderness or **national-scale** natural systems as the only subject when a local community place exists in the list

**Keep** only **geographic** articles: neighbourhoods, suburbs, districts, streets, corridors, parks, airports, stations (transit **facilities**), named squares, historic districts, **suburbs**, **hamlets**, **reserves** (geographic), **rivers/hills** when used as local place references.

**Buildings and landmarks:** keep when the article describes a **real-world location** people use for directions or local identity (city hall, cathedral, stadium **as a landmark** is borderline - prefer **district/park/street** articles when the hint is geographic; **never** keep a team franchise page).

If every title is unsuitable, return {"kept":[]}. Copy **exact** title spelling from the input lines.`;

export type FilterWikipediaTitlesForCommunityEntityParams = {
  apiKey: string;
  siteId?: string;
  model?: string;
  /** Ordered candidate titles (English Wikipedia). */
  titles: string[];
  /** Optional lead snippet per title (same length as titles); improves accuracy. */
  introSnippets?: string[];
};

/**
 * Uses OpenRouter to drop non-geography Wikipedia titles (teams, media, orgs, dig sites, …).
 * Requires a valid OpenRouter API key - no silent pass-through.
 */
export async function filterWikipediaTitlesForCommunityEntity(
  params: FilterWikipediaTitlesForCommunityEntityParams
): Promise<string[]> {
  const { apiKey, siteId, titles } = params;
  const inputTitles = titles.map((t) => t.trim()).filter(Boolean);
  if (!apiKey.trim()) {
    throw new Error("OpenRouter API key is required for Wikipedia geography title filtering.");
  }
  if (inputTitles.length === 0) return [];

  await ensureMasterInstructionsInMemory(siteId);

  const intros = params.introSnippets;
  const lines = inputTitles.map((t, i) => {
    const snip = intros && intros[i] != null ? String(intros[i]).replace(/\s+/g, " ").trim().slice(0, 360) : "";
    return snip ? `${i + 1}. Title: ${t}\n   Intro: ${snip}` : `${i + 1}. ${t}`;
  });

  const user = `Candidate Wikipedia article titles (in order - output kept subset in this same order):

${lines.join("\n\n")}

Return JSON only: {"kept":[...exact titles from above...]}`;

  const model = params.model?.trim() || getResearchModel(siteId);
  const { streamChatCompletion } = await import("../api");
  const systemWithMaster = appendMasterInstructionsToSystemPrompt(SYS_FILTER, siteId ?? null);
  let raw = "";
  await streamChatCompletion({
    apiKey,
    model,
    messages: [
      { role: "system", content: systemWithMaster },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    maxTokens: 1200,
    topP: 0.9,
    onContentChunk: (c) => {
      raw += c;
    },
  });

  const cleaned = stripJsonFence(raw);
  let keptRaw: unknown[] = [];
  try {
    const obj = JSON.parse(cleaned) as { kept?: unknown };
    if (Array.isArray(obj.kept)) keptRaw = obj.kept;
  } catch {
    return [];
  }

  const lowerToCanonical = new Map<string, string>();
  for (const t of inputTitles) {
    lowerToCanonical.set(t.toLowerCase(), t);
  }

  const out: string[] = [];
  const used = new Set<string>();
  for (const k of keptRaw) {
    const s = String(k ?? "").trim();
    if (!s) continue;
    const canon = lowerToCanonical.get(s.toLowerCase());
    if (canon && !used.has(canon.toLowerCase())) {
      used.add(canon.toLowerCase());
      out.push(canon);
    }
  }

  if (out.length === 0) return [];
  return out;
}
