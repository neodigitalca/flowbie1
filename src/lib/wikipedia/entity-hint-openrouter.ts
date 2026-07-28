import { getResearchModel } from "../optimization-settings-storage";

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function streamResearchCompletion(params: {
  apiKey: string;
  siteId?: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const { streamChatCompletion } = await import("../api");
  let out = "";
  await streamChatCompletion({
    apiKey: params.apiKey,
    model: getResearchModel(params.siteId),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: params.temperature ?? 0.15,
    maxTokens: params.maxTokens ?? 500,
    topP: 0.9,
    onContentChunk: (c) => {
      out += c;
    },
  });
  return out.trim();
}

/** Case-insensitive match of model output to one of the candidate titles. */
export function matchTitleInList(raw: string, candidates: string[]): string | null {
  const cleaned = stripJsonFence(raw);
  let obj: { chosen?: string | null; title?: string | null } | null = null;
  try {
    obj = JSON.parse(cleaned) as { chosen?: string | null; title?: string | null };
  } catch {
    const m = cleaned.match(/"chosen"\s*:\s*"([^"]*)"/i) || cleaned.match(/"title"\s*:\s*"([^"]*)"/i);
    if (m?.[1]) {
      obj = { chosen: m[1] };
    }
  }
  const pick = obj?.chosen ?? obj?.title;
  if (pick === null || pick === undefined || String(pick).trim() === "") return null;
  const want = String(pick).trim();
  const lower = want.toLowerCase();
  for (const c of candidates) {
    if (c.trim().toLowerCase() === lower) return c;
  }
  return null;
}

const SYS_PICK = `You choose the single best English Wikipedia article for a user's **geographic** local entity hint (service-area SEO).
Reply with ONLY valid JSON: {"chosen":"<exact title from the list>"} or {"chosen":null} if none fit.
The value must match one candidate title exactly (same spelling and punctuation).
If the hint is "Place, City, Province" and the first part names a neighborhood, corridor, avenue, park, or district, NEVER choose the city/municipality article alone (e.g. the page titled like the city name only). Prefer the specific sub-city article.
NEVER choose a "List of …" or similar index page when a specific street, avenue, or district article exists in the list.
**Geography-only:** Choose **places** - neighbourhoods, districts, streets, corridors, parks, airports, landmarks, natural features, civic **buildings** used as place references. **NEVER** choose **sports teams or clubs**, **newspapers or broadcasters**, **companies**, or other **non-place organizations** - even if the name includes a city.
**Otherwise:** Prefer populated places where people live, work, or identify locally. **Avoid** archaeological dig sites, remote trail systems, sports **governing** federations, or civic federations **when** a clearer geographic place fits the hint.`;

export async function pickTitleFromCandidates(
  entityHint: string,
  candidates: string[],
  siteId: string | undefined,
  apiKey: string
): Promise<string | null> {
  if (candidates.length === 0) return null;
  const list = candidates.slice(0, 25).map((t, i) => `${i + 1}. ${t}`).join("\n");
  const user = `Entity hint: "${entityHint}"

Candidate article titles (English Wikipedia search results):
${list}

Pick the one article that best describes the same real-world place or topic as the entity hint.
Disambiguate carefully: e.g. retail / central corridors often match a "SW" avenue article vs "SE" when the city context implies west/central; neighborhoods vs city-wide articles; prefer the specific district when the hint names a district.
Do not choose a broad city-only article when the hint clearly refers to a smaller area within that city.

Return JSON only: {"chosen":"..."} or {"chosen":null}.`;

  const out = await streamResearchCompletion({
    apiKey,
    siteId,
    system: SYS_PICK,
    user,
    maxTokens: 400,
    temperature: 0.1,
  });
  return matchTitleInList(out, candidates);
}

const SYS_BROADEN = `You help find English Wikipedia articles for **geographic** local entity strings (places only).
Reply with ONLY valid JSON: {"searchQuery":"..."} to run another search, and/or {"title":"Exact Article Title"} if you know the canonical page title. Use empty string to omit a field.
When the hint names a neighborhood, corridor, or street area within a city, propose a search query or title for THAT place - not the city-wide municipality article alone.
For numbered avenues (e.g. "17 Ave"), search like "17 Avenue SE (City)" or "17 Avenue SW City" - not "List of shopping streets" or other list articles.
Propose **geographic** places only - neighbourhoods, districts, streets, parks, airports, landmarks, towns. **Never** propose sports teams, newspapers, TV/radio stations, or other non-place organizations. Do not propose archaeological sites or sports federations unless the hint explicitly names that topic.`;

export async function suggestBroaderSearch(
  entityHint: string,
  siteId: string | undefined,
  apiKey: string
): Promise<{ searchQuery?: string; title?: string }> {
  const user = `Entity hint: "${entityHint}"

Search results were empty or poor. Propose ONE concise English Wikipedia search query (people, places, roads) that would surface the right article, and/or an exact article title if you know it.

Return JSON only, e.g. {"searchQuery":"17 Avenue SW Calgary","title":""}`;

  const out = stripJsonFence(await streamResearchCompletion({
    apiKey,
    siteId,
    system: SYS_BROADEN,
    user,
    maxTokens: 300,
    temperature: 0.2,
  }));
  try {
    const o = JSON.parse(out) as { searchQuery?: string; title?: string };
    return {
      searchQuery: o.searchQuery?.trim() || undefined,
      title: o.title?.trim() || undefined,
    };
  } catch {
    return {};
  }
}

const SYS_FORCED = `You must pick exactly one English Wikipedia article title from the numbered list for the user's **geographic** entity hint.
Even if imperfect, choose the best match (e.g. correct quadrant of a road, neighborhood vs city).
Never pick the city/municipality umbrella page when the hint names a specific sub-city area and the list contains a more specific article.
Prefer **geographic** places (neighbourhoods, districts, streets, parks, airports, landmarks) over **sports teams, newspapers, media, companies**, archaeological sites, dig sites, or non-place organizations when those appear in the list.
Reply with ONLY valid JSON: {"chosen":"<exact title from list>"}`;

export async function forcedPickFromList(
  entityHint: string,
  candidates: string[],
  siteId: string | undefined,
  apiKey: string
): Promise<string | null> {
  if (candidates.length === 0) return null;
  const list = candidates.slice(0, 25).map((t, i) => `${i + 1}. ${t}`).join("\n");
  const user = `Entity hint: "${entityHint}"

You MUST choose exactly one title from this list (copy it exactly):
${list}

Return JSON only: {"chosen":"..."}`;

  const out = await streamResearchCompletion({
    apiKey,
    siteId,
    system: SYS_FORCED,
    user,
    maxTokens: 200,
    temperature: 0.05,
  });
  return matchTitleInList(out, candidates);
}

const SYS_CANONICAL = `You output the exact English Wikipedia article title for a **geographic place** (streets, neighbourhoods, parks, districts, cities, airports, landmarks - not organizations).
Reply with ONLY valid JSON: {"title":"Exact Title As On Wikipedia"} or {"title":""} if unknown.
For hints like "Neighborhood, City, AB", return the article for the neighborhood (or street/corridor), not the city article alone, when such an article exists on English Wikipedia.
**Never** return sports teams, newspapers, broadcasters, or other non-place articles. Prefer human communities and geographic features - not archaeological dig sites or sports governing bodies unless the hint explicitly names that topic.`;

export async function proposeCanonicalArticleTitle(
  entityHint: string,
  siteId: string | undefined,
  apiKey: string
): Promise<string | null> {
  const user = `What is the canonical English Wikipedia article title for this entity?
Entity: "${entityHint}"

Return JSON only: {"title":"..."}`;

  const out = stripJsonFence(await streamResearchCompletion({
    apiKey,
    siteId,
    system: SYS_CANONICAL,
    user,
    maxTokens: 120,
    temperature: 0.1,
  }));
  try {
    const o = JSON.parse(out) as { title?: string };
    const t = o.title?.trim();
    return t || null;
  } catch {
    return null;
  }
}
