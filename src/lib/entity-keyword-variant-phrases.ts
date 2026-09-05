import {
  parseEntityPlaceParts,
  resolveServiceTopicKeyword,
} from "@/lib/entity-place-reference";

/** General {topic} + place patterns — weights guide OpenRouter distribution (not hardcoded product/place). */
export type EntityKeywordVariantTemplate = {
  id: string;
  pattern: string;
  weightPercent: number;
};

export const ENTITY_KEYWORD_VARIANT_TEMPLATES: readonly EntityKeywordVariantTemplate[] = [
  { id: "topic-in-neighborhood", pattern: "{topic} in {neighborhood}", weightPercent: 18 },
  { id: "topic-for-city-homes", pattern: "{topic} for {city} homes", weightPercent: 18 },
  { id: "synonym-in-neighborhood", pattern: "{topicSynonym} in {neighborhood}", weightPercent: 15 },
  { id: "custom-topic-local-homes", pattern: "custom {topic} for local homes", weightPercent: 12 },
  { id: "synonym-homeowners-city", pattern: "{topicSynonym} for homeowners in {city}", weightPercent: 15 },
  { id: "topic-homes-neighborhood-area", pattern: "{topic} for homes in the {neighborhood} area", weightPercent: 12 },
  { id: "topic-homeowners-neighborhood-city", pattern: "{topic} for homeowners in {neighborhood}, {city}", weightPercent: 10 },
] as const;

export const ENTITY_KEYWORD_VARIANT_RULE = `**ENTITY KEYWORD VARIANTS (NON-NEGOTIABLE — general entity / local pages)**:
- The writing keyword is the subject. Most topic mentions **omit the place entity** (~70%). Place + topic variants below cover only the remaining ~30% of local phrasing.
- After Answer establishes the topic, use **natural place + topic variants** from the weighted template list in this prompt — not "{topic} {neighborhood} {city}" slug stacks.
- OpenRouter: of the ~30% of mentions that include a place name, pick phrasing using each template's **weight %** as approximate share (e.g. ~18% of those place-flavored mentions use "{topic} in {neighborhood}").
- Use **{topicSynonym}** for semantic variants of the writing keyword (adapt to the page topic).
- Prefer "homeowners in {neighborhood}, {city}" over repeating the exact primary keyword with every place name.
- Forbidden: "the perfect {topic} {area} needs", "Homes near {topic} {area} often", "{topic} {neighborhood} {city} residents need".
- Exact place-entity string obeys A+ KEYWORD AUTHORITY / SERVICE AREA DENSITY (at most ~3 article-wide).`;

type VariantFillInput = {
  topic: string;
  topicSynonym: string;
  neighborhood: string;
  city: string;
};

function patternNeedsNeighborhood(pattern: string): boolean {
  return pattern.includes("{neighborhood}");
}

function patternNeedsCity(pattern: string): boolean {
  return pattern.includes("{city}");
}

function patternNeedsSynonym(pattern: string): boolean {
  return pattern.includes("{topicSynonym}");
}

function fillVariantPattern(pattern: string, input: VariantFillInput): string {
  return pattern
    .replace(/\{topicSynonym\}/g, input.topicSynonym)
    .replace(/\{topic\}/g, input.topic)
    .replace(/\{neighborhood\}/g, input.neighborhood)
    .replace(/\{city\}/g, input.city);
}

/** Prompt block: weighted templates + filled examples. Requires entity comma label + keyword. */
export function formatEntityKeywordVariantPromptBlock(input: {
  entity: string;
  keyword: string;
  topicSynonymHint?: string;
}): string {
  const entityRaw = input.entity.trim();
  const keyword = input.keyword.trim();
  if (!entityRaw || !keyword) return "";

  const placeParts = parseEntityPlaceParts(entityRaw);
  if (!placeParts.canonical) return "";

  const topic = resolveServiceTopicKeyword(keyword, entityRaw);
  if (!topic) return "";

  const neighborhood = placeParts.neighborhood;
  const city = placeParts.city;
  const topicSynonym = input.topicSynonymHint?.trim() ?? "";

  const fill: VariantFillInput = { topic, topicSynonym, neighborhood, city };

  const lines = [
    "--- ENTITY KEYWORD VARIANTS (MANDATORY — weighted templates) ---",
    `Topic (service phrase — exact match sparingly): ${topic}`,
    `Place entity (comma label): ${placeParts.proseLabel}`,
    neighborhood ? `Neighborhood: ${neighborhood}` : "",
    city ? `City: ${city}` : "",
    "",
    "OpenRouter: distribute local topic phrasing using these template weights (approximate % of variant uses across the page):",
  ];

  for (const t of ENTITY_KEYWORD_VARIANT_TEMPLATES) {
    if (patternNeedsNeighborhood(t.pattern) && !neighborhood) continue;
    if (patternNeedsCity(t.pattern) && !city) continue;
    if (patternNeedsSynonym(t.pattern) && !topicSynonym) continue;
    lines.push(`- ${t.weightPercent}% — pattern: ${t.pattern}`);
    lines.push(`  Example: "${fillVariantPattern(t.pattern, fill)}"`);
  }

  lines.push(
    "",
    ENTITY_KEYWORD_VARIANT_RULE,
    "--- END ENTITY KEYWORD VARIANTS ---",
  );

  return lines.filter(Boolean).join("\n");
}
