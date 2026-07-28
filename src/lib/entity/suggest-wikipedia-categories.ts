/**
 * Optional Prompt Modifier → OpenRouter intent → enwiki Category search (ns 14) → optional rank.
 * Returns WikipediaSource[] with category titles (no "Category:" prefix) for use with runOriginsToWikiFlow.
 */

import { streamChatCompletion } from '@/lib/api';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import { searchWikipediaCategories } from '@/lib/wikipedia-api';
import type { WikipediaSource } from './decide-wikipedia-source-ai';

function stripCategoryPrefix(fullTitle: string): string {
  return fullTitle.replace(/^Category:\s*/i, '').trim();
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const v = JSON.parse(cleaned) as Record<string, unknown>;
    if (v && typeof v === 'object') return v;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      const v = JSON.parse(m[0]) as Record<string, unknown>;
      if (v && typeof v === 'object') return v;
    }
  }
  throw new Error('Invalid JSON from model');
}

function parseStringArray(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const v = JSON.parse(cleaned);
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    const m = cleaned.match(/\[[\s\S]*\]/);
    if (m) {
      const v = JSON.parse(m[0]);
      if (Array.isArray(v)) {
        return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

async function runOpenRouterJson(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
  signal?: AbortSignal
): Promise<string> {
  let out = '';
  await streamChatCompletion({
    apiKey,
    model: getResearchModel(),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    maxTokens,
    topP: 0.9,
    signal,
    onContentChunk: (chunk) => {
      out += chunk;
    },
  });
  return out.trim();
}

/**
 * Build search-queries intent, pull Category pages from enwiki, optionally re-rank with the model.
 */
export async function suggestWikipediaCategoriesForPrompt(
  userText: string,
  keyword: string | undefined,
  apiKey: string,
  options?: { signal?: AbortSignal }
): Promise<WikipediaSource[]> {
  const signal = options?.signal;
  const trimmed = userText.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const kw = keyword?.trim() ? keyword.trim() : '';

  const intentSystem = `You assess what English Wikipedia **Category** pages would best match the user's geographic / locality intent.

Return ONLY valid JSON (no markdown):
{"intent":"one short sentence","searchQueries":["query1","query2",...]}

Rules:
- searchQueries: 2 to 5 short search strings that would find **Category:** pages on English Wikipedia (neighborhoods, streets, postal codes, cities, districts, etc.).
- Use natural phrases like "Neighbourhoods in Edmonton", "Streets in Calgary", "ZIP codes in Wisconsin" - the wiki search will be restricted to Category namespace.
- Do not include the word "Category:" in searchQueries (the API adds namespace).
- The business keyword (if any) is context only; categories must still be about **places/locations**, not products or brands.`;

  const intentUser = `User text:\n${trimmed}\n${kw ? `\nBusiness/service keyword (context only): ${kw}\n` : ''}\nReturn JSON:`;

  let searchQueries: string[] = [];
  try {
    const raw = await runOpenRouterJson(apiKey, intentSystem, intentUser, 400, signal);
    const parsed = parseJsonObject(raw);
    const q = parsed.searchQueries;
    if (Array.isArray(q)) {
      searchQueries = q
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
    }
  } catch {
    searchQueries = [trimmed];
  }

  if (searchQueries.length === 0) searchQueries = [trimmed];

  const categoryTitles = await searchWikipediaCategories(searchQueries, 12);
  if (categoryTitles.length === 0) return [];

  let orderedTitles = categoryTitles;
  if (categoryTitles.length > 8) {
    const rankSystem = `You pick the best English Wikipedia category titles for the user's intent.

Return ONLY a JSON array of strings (no markdown): the **best 10** titles in descending order of relevance.
Each string must be exactly as given in the list (including "Category:" prefix if present).`;

    const rankUser = `User text:\n${trimmed}\n${kw ? `Keyword (context): ${kw}\n` : ''}\nCandidate category titles:\n${categoryTitles.join('\n')}\n\nReturn JSON array of up to 10 titles:`;

    try {
      const rawRank = await runOpenRouterJson(apiKey, rankSystem, rankUser, 500, signal);
      const ranked = parseStringArray(rawRank);
      const setLower = new Map(categoryTitles.map((t) => [t.toLowerCase(), t]));
      const picked: string[] = [];
      for (const r of ranked) {
        const canon = setLower.get(r.trim().toLowerCase());
        if (canon && !picked.includes(canon)) picked.push(canon);
        if (picked.length >= 10) break;
      }
      if (picked.length > 0) orderedTitles = [...picked, ...categoryTitles.filter((t) => !picked.includes(t))];
    } catch {
      orderedTitles = categoryTitles;
    }
  }

  const seen = new Set<string>();
  const out: WikipediaSource[] = [];
  for (const full of orderedTitles) {
    const bare = stripCategoryPrefix(full);
    if (!bare) continue;
    const k = bare.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ type: 'category', title: bare });
    if (out.length >= 12) break;
  }
  return out;
}
