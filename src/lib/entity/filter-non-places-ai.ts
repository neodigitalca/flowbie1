/**
 * AI-only filter: remove non-places from Wikipedia category pool.
 * No static list, no fallbacks - the model decides which titles are real geographic places.
 * Filters out e.g. "Index of Florida-related articles", list pages, meta articles.
 */

import { streamChatCompletion } from '@/lib/api';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import type { CategoryPoolEntity } from './category-pool';

/**
 * Use AI to keep only Wikipedia titles that are real geographic places.
 * Excludes index pages, list pages, meta articles, disambiguation, "X-related articles", etc.
 * When entityTypeHint indicates postal/ZIP codes, treat postal/ZIP identifiers as valid geographic entities.
 * No static filter and no fallback: if the API fails, we throw.
 */
export async function filterNonPlacesWithAI(
  pool: CategoryPoolEntity[],
  apiKey: string,
  onProgress?: (message: string) => void,
  entityTypeHint?: string,
  keyword?: string
): Promise<CategoryPoolEntity[]> {
  if (pool.length === 0) return [];

  const wantsPostal =
    typeof entityTypeHint === 'string' &&
    /postal\s*code|postal\s*codes|zip\s*code|zip\s*codes/i.test(entityTypeHint);

  const keywordContext =
    typeof keyword === 'string' && keyword.trim().length > 0
      ? ` The business/service context keyword is "${keyword.trim()}". Use it only as context for which geographic places are most relevant; do not treat it as a topic or filter out locations that could reasonably host that service.`
      : '';

  onProgress?.(
    wantsPostal
      ? 'Filtering non-places with AI (postal / ZIP codes allowed as entities)...'
      : 'Filtering non-places with AI (no static list)...'
  );

  const systemPrompt = `You are an ultra-strict geographic place filter. You will receive a list of Wikipedia article TITLES.${keywordContext}

Your task: Return ONLY titles that are PHYSICAL GEOGRAPHIC ENTITIES you can point to on a map - cities, towns, villages, neighborhoods, suburbs, boroughs, districts, counties, parishes, municipalities, provinces, states, regions, streets, roads, avenues, landmarks, buildings, parks, lakes, rivers, mountains, islands, peninsulas${
    wantsPostal ? ', and postal / ZIP code identifiers' : ''
  }.

A valid entity is a PLACE WITH A PHYSICAL LOCATION ON EARTH. If you cannot pin it on a map, EXCLUDE it.

EXCLUDE ALL OF THESE (they are NOT geographic entities even if they contain a place name):
- Concepts, topics, abstract ideas (e.g. "Economy of Canada", "Culture of Texas")
- Cultural, social, religious topics (e.g. "Ramadan in Canada", "Anglo-America", "English Canada")
- Legal, political, social phenomena (e.g. "Prostitution in Canada", "Crime in Chicago", "Poverty in Detroit")
- Industries, occupations, activities (e.g. "Seal hunting in Canada", "Fishing in Alaska", "Mining in Nevada")
- Ethnic, demographic, linguistic groups (e.g. "French Canadians", "Hispanic Americans")
- Historical events, movements, eras (e.g. "History of Edmonton", "Civil rights movement")
- Generic/broad terms that are not a specific place (e.g. "Ranch", "Suburb", "Downtown")
- Lists, indexes, meta pages (e.g. "Index of X", "List of X-related articles", "X-related articles")
- Disambiguation pages, categories, portals, templates
- Government, law, policy articles (e.g. "Government of Alberta", "Law enforcement in X")
- Transportation systems (e.g. "Transportation in X") - but specific stations/airports ARE valid
- Education/healthcare systems (e.g. "Education in X", "Healthcare in X") - but specific schools/hospitals ARE valid
- Flora, fauna, wildlife articles (e.g. "Birds of Canada")
- Sports teams, leagues, organizations
- ANY article that describes a topic, phenomenon, activity, tradition, practice, system, or concept - even if the title contains a geographic name

ASK YOURSELF: "Is this the name of an actual place/location I can find on a map?" If NO → EXCLUDE.
${
  wantsPostal
    ? `
POSTAL / ZIP CODE RULES:
- Postal / ZIP code identifiers like "T5K", "T6G", "M4B postal codes", "90210", or "ZIP codes in California" ARE valid geographic entities when they clearly refer to postal/ZIP code areas.
- Keep list or category pages that specifically represent sets of postal/ZIP codes for a region.`
    : ''
}

Respond with ONLY a JSON array of strings: the exact titles that ARE valid geographic places, in the same order as input. Use exact same spelling and capitalization as input.
Example: ["Baton Rouge, Louisiana", "Riverside, Edmonton", "Jasper Avenue"${
    wantsPostal ? ', "List of ZIP Code prefixes", "Postal codes in Canada: T"' : ''
  }]
No other text, no markdown, no explanation. Only the JSON array.`;

  const titlesList = pool.map((e) => e.entity).join('\n');
  const userPrompt = `Wikipedia article titles (one per line). Return ONLY titles that are actual physical places on a map. Exclude EVERYTHING that is a concept, topic, tradition, activity, industry, phenomenon, culture, economy, legal issue, or any other non-place - even if the title contains a geographic name.

${titlesList}

JSON array of ONLY physical places (exact same strings as above):`;

  let out = '';
  try {
    const result = await streamChatCompletion({
      apiKey,
      model: getResearchModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 8192,
      topP: 0.9,
      onContentChunk: (chunk) => {
        out += chunk;
      },
    });
    out = (result?.content ?? out).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`AI non-place filter failed (no fallback): ${msg}`);
  }

  out = out.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  let allowedTitles: string[] = [];
  try {
    const match = out.match(/\[[\s\S]*\]/);
    if (match) {
      allowedTitles = JSON.parse(match[0]) as string[];
      if (!Array.isArray(allowedTitles)) {
        allowedTitles = [];
      }
    }
  } catch {
    throw new Error('AI non-place filter returned invalid JSON (no fallback).');
  }

  const allowedLower = new Set(allowedTitles.map((t) => t.trim().toLowerCase()).filter(Boolean));
  const filtered = pool.filter((e) => allowedLower.has(e.entity.trim().toLowerCase()));
  onProgress?.(`AI kept ${filtered.length}/${pool.length} real places.`);
  return filtered;
}
