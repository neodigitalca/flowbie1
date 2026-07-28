/**
 * Geographic scope for Local analysis entity labels (SAP / entityHint).
 * City = hyperlocal (default product behavior); national / provincial relax granularity.
 */

export type EntityGeographicLevel = "national" | "provincial" | "city";

export const DEFAULT_ENTITY_GEOGRAPHIC_LEVEL: EntityGeographicLevel = "city";

/** Full entity-type category lists per level (UI reference + prompt injection). */
export const ENTITY_TYPE_TAXONOMY: Record<EntityGeographicLevel, readonly string[]> = {
  national: [
    "National capital cities",
    "Major metropolitan areas",
    "Secondary cities and regional hubs",
    "National parks and major protected areas",
    "Major intercity corridors and named highway belts",
    "Cross-border gateway cities",
    "Large census / economic regions (named)",
    "Major islands or archipelagos (where relevant)",
    "National landmarks and major civic centers (named places)",
  ],
  provincial: [
    "Provincial / state capital cities",
    "County seats and regional municipalities",
    "Census divisions and regional districts",
    "Provincial / state parks and recreation areas",
    "In-province corridors and valley belts",
    "Major in-state / in-province metros after the primary market",
    "Subregions (e.g. Northern, Coastal, Prairie) when used as place labels",
    "Large unorganized / rural service areas (named)",
    "Border cities within the province or state",
  ],
  city: [
    "Neighbourhoods and residential quarters",
    "Business districts and downtown cores",
    "Street-as-place corridors and main streets",
    "Parks, trails, and river valleys (named)",
    "Landmarks, civic buildings, and named complexes",
    "Industrial pockets and business parks",
    "Historic districts and quarters",
    "Suburbs and inner-ring communities",
    "Waterfront or campus-adjacent micro-areas",
  ],
} as const;

/** Default entity-type focus for Generator / Local analysis (city-level). */
export const DEFAULT_ENTITY_TYPE_FOCUS: readonly string[] = [
  ENTITY_TYPE_TAXONOMY.city[0]!,
];

export function entityTypeFocusWantsNeighbourhoods(focus: readonly string[] | undefined): boolean {
  if (!focus?.length) return false;
  const want = ENTITY_TYPE_TAXONOMY.city[0]!.toLowerCase();
  return focus.some((f) => {
    const t = f.trim().toLowerCase();
    return t === want || /\bneighbourhoods?\b/i.test(f) || /\bneighborhoods?\b/i.test(f);
  });
}

export function entityTypesForLevel(level: EntityGeographicLevel): readonly string[] {
  return ENTITY_TYPE_TAXONOMY[level];
}

export function resolveEntityGeographicLevel(
  raw: EntityGeographicLevel | undefined | null,
): EntityGeographicLevel {
  return raw === "national" || raw === "provincial" ? raw : "city";
}

/**
 * Compact bullet list for system prompts.
 */
export function formatEntityTaxonomyForPrompt(
  level: EntityGeographicLevel,
  focus?: readonly string[] | null,
): string {
  const base = entityTypesForLevel(level);
  const lines = base.map((t) => `- ${t}`).join("\n");
  const trimmed = (focus ?? []).map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) return lines;
  return `${lines}\n\n**User-prioritized entity types (prefer these when they fit the business and geography):** ${trimmed.join("; ")}`;
}

export function entityLevelLabel(level: EntityGeographicLevel): string {
  switch (level) {
    case "national":
      return "National";
    case "provincial":
      return "Provincial / state";
    default:
      return "City–metro";
  }
}

/** Short labels for Local analysis dropdowns only; prompts still use ENTITY_TYPE_TAXONOMY. */
export function entityLevelShortLabel(level: EntityGeographicLevel): string {
  switch (level) {
    case "national":
      return "National";
    case "provincial":
      return "Provincial";
    default:
      return "City";
  }
}

/** Same order and length as ENTITY_TYPE_TAXONOMY[level]. */
export const ENTITY_TYPE_TAXONOMY_UI_SHORT: Record<EntityGeographicLevel, readonly string[]> = {
  national: [
    "Capitals",
    "Major metros",
    "Regional hubs",
    "National parks",
    "Intercity corridors",
    "Border gateways",
    "Named regions",
    "Islands",
    "Landmarks",
  ],
  provincial: [
    "Prov. capitals",
    "Counties",
    "Census divisions",
    "Prov. parks",
    "Corridors",
    "Other metros",
    "Subregions",
    "Rural areas",
    "Border cities",
  ],
  city: [
    "Neighbourhoods",
    "Downtown",
    "Main streets",
    "Parks / trails",
    "Landmarks",
    "Industrial",
    "Historic areas",
    "Suburbs",
    "Waterfront",
  ],
} as const;

export function entityTypeShortLabel(level: EntityGeographicLevel, fullTaxonomyLine: string): string {
  const full = entityTypesForLevel(level);
  const short = ENTITY_TYPE_TAXONOMY_UI_SHORT[level];
  const i = full.indexOf(fullTaxonomyLine as (typeof full)[number]);
  return i >= 0 && short[i] != null ? short[i]! : fullTaxonomyLine;
}

/** Longest UI short label for entity-type focus selects (includes "None"). */
export function widestEntityTypeShortLabel(level: EntityGeographicLevel): string {
  const labels: string[] = ["None", ...ENTITY_TYPE_TAXONOMY_UI_SHORT[level]];
  return labels.reduce((max, label) => (label.length > max.length ? label : max), "None");
}

/** Short line for targets block: what to vary across rows. */
export function targetsBlockEntityDifferentiationNote(level: EntityGeographicLevel): string {
  switch (level) {
    case "national":
      return "distinct **national-scale** place types (capital cities, major metros, named regions, national parks, major corridors) grounded in the user's market and hints";
    case "provincial":
      return "distinct **provincial- or state-scale** place types (regional cities, county seats, provincial parks, subregions, in-province corridors) grounded in the user's market and hints";
    default:
      return "distinct **neighbourhood- and district-scale** first segments; **prioritize** neighbourhood, district, and named-community labels from evidence, then parks, landmarks, and main-street as place when diversity or the grid requires it";
  }
}

/** Multi-row optional note on targets (after "Output entity"). */
export function targetsBlockMultiRowNote(level: EntityGeographicLevel, manual: boolean): string {
  if (level !== "city") {
    return ` Use ${targetsBlockEntityDifferentiationNote(level)}.`;
  }
  return manual
    ? " **Prioritize** neighbourhood, district, and named-community **first** segments per row; add street-as-place, park, or landmark when hints lack neighbourhood names or you need a distinct non-duplicate place."
    : " **Prioritize** neighbourhood, district, and named-community names from the grid; add street-as-place, park, or landmark when the grid has no such label for that area or you need a distinct place without repeating a neighbourhood.";
}

function focusSentence(entityTypeFocus?: readonly string[] | null): string {
  const f = (entityTypeFocus ?? []).map((s) => s.trim()).filter(Boolean);
  if (f.length === 0) return "";
  return `\n\n**Entity type focus (user-selected):** Prefer these categories when they fit the business and geography: ${f.join("; ")}.`;
}

/** Grid-mode SAP entity rules when scope is broader than city. */
export function buildSapEntityFieldRulesGridBroad(
  level: EntityGeographicLevel,
  entityTypeFocus?: readonly string[] | null,
): string {
  const tax = formatEntityTaxonomyForPrompt(level, entityTypeFocus);
  const focus = focusSentence(entityTypeFocus);
  if (level === "national") {
    return `**SAP "entity" field (mandatory) - geographic scope: NATIONAL:** \`entity\` is a structured place label for **country-wide or multi-region** service-area targeting. **No filler words, no prose, no prefixes** at the start.${focus}

- **Shape:** **Two to four** comma-separated segments as needed: named place or region (city, metro, national park, major corridor label, or region name), then **province/state** or **country** when useful for clarity. **First segment** names a **real geographic place or region** at national scale (e.g. capital city, major metro, national park, named economic region) - **not** a street address.
- **First segment = geographic name:** Begin with a **proper place name** (e.g. \`Ottawa\`, \`Vancouver\`, \`Banff National Park\`, \`Golden Horseshoe\`). **Forbidden at the start:** \`Near \`, \`Around \`, \`Close to \`, \`By \`, \`At \`, \`In \`, \`In the \`.
- **Where to use "near":** In \`title\` only, not in \`entity\`.
- **Diversity:** Prefer **different first-segment *types*** across rows from this list when \`sapPages\` > 1:
${tax}
- **Grid:** When grid evidence exists, you may still use **distinct** national or multi-city entities that **make sense** for the business and keyword; do not invent fantasy locations. **Forbidden in \`entity\`:** street numbers, unit lines, full mailing addresses, postal codes.`;
  }
  /* provincial */
  return `**SAP "entity" field (mandatory) - geographic scope: PROVINCIAL / STATE:** \`entity\` is a structured place label for **province- or state-wide** service-area targeting. **No filler words, no prose, no prefixes** at the start.${focus}

- **Shape:** **Two or three** comma-separated segments: named city, subregion, major park, or corridor **first**; then **province/state** or secondary city when needed. **First segment** is a **proper place name** at regional scale (provincial capital, large metro in-state, county seat, provincial park, named subregion).
- **First segment = geographic name:** e.g. \`Red Deer\`, \`Cape Breton Island\`, \`Kananskis Country\`, \`Calgary Region\` - **not** a full street address. **Forbidden at the start:** conversational prefixes (\`Near \`, \`Around \`, etc.).
- **Where to use "near":** In \`title\` only, not in \`entity\`.
- **Diversity:** When \`sapPages\` > 1, use **distinct** first-segment types from:
${tax}
- **Grid:** Ground choices in user hints, market label, and grid evidence when present. **Forbidden in \`entity\`:** street numbers, unit lines, full mailing addresses, postal codes.`;
}

/** Manual-mode SAP entity rules when scope is broader than city. */
export function buildSapEntityFieldRulesManualBroad(
  level: EntityGeographicLevel,
  entityTypeFocus?: readonly string[] | null,
): string {
  const tax = formatEntityTaxonomyForPrompt(level, entityTypeFocus);
  const focus = focusSentence(entityTypeFocus);
  if (level === "national") {
    return `**SAP "entity" field (mandatory) - geographic scope: NATIONAL:** \`entity\` is a structured place label for **country-wide** service-area pages. **No filler words, no prose, no prefixes** at the start.${focus}

- **Shape:** **Two to four** comma-separated segments: named city, metro, region, national park, or major corridor; add **province/state** or **country** when useful.
- **First segment** = proper **national-scale** place or region name. **Forbidden at the start:** \`Near \`, \`Around \`, etc.
- **Good examples:** \`Ottawa, ON, Canada\`; \`Vancouver, BC\`; \`Jasper National Park, AB\`; \`Greater Toronto Area, ON\`.
- **Diversity across rows:**
${tax}
- **No grid:** Use hints, market label, and Wikipedia intros to ground names. **Forbidden:** street numbers, full addresses, postal codes.`;
  }
  return `**SAP "entity" field (mandatory) - geographic scope: PROVINCIAL / STATE:** \`entity\` is a structured place label for **province- or state-wide** service-area pages. **No filler words, no prose, no prefixes** at the start.${focus}

- **Shape:** **Two or three** comma-separated segments: regional city, subregion, provincial park, or corridor **first**; then **province/state** when needed.
- **First segment** = proper place name at regional scale. **Forbidden at the start:** conversational prefixes.
- **Diversity across rows:**
${tax}
- **No grid:** Use hints and market to pick plausible **distinct** entities; do not duplicate the same \`entity\` on two rows. **Forbidden:** street numbers, full addresses, postal codes.`;
}

/** Footer bullets (grid mode) after main sapRows allocation rules - broad scope only. */
export function buildSapEntityFooterGridBroad(
  level: EntityGeographicLevel,
): string {
  if (level === "national") {
    return `- **Per-target optional entity hint:** If present, prioritize that geography for those SAP rows. Output "entity" at **national scale** - major cities, regions, national parks, or named corridors - **comma-separated**, no prose. When \`sapPages\` > 1, use **distinct** first-segment place types (see taxonomy in system prompt).
- **"entity" label:** **Named place or region first**, then larger divisions (province, country) as needed. No \`Near\` / \`Around\` prefixes.
- **Geographic scope:** Entities should be **plausible** for the business and keyword; do not invent obscure places. When grid evidence exists, stay **consistent** with the user's market unless the user explicitly targets multiple regions.
- If **Wikipedia intros** are present, use them only to ground **names** - not as a substitute for sensible geography.`;
  }
  return `- **Per-target optional entity hint:** If present, prioritize that geography. Output "entity" at **provincial / state scale** - regional cities, subregions, provincial parks, corridors. When \`sapPages\` > 1, use **distinct** first-segment types (see taxonomy).
- **"entity" label:** **Named place or subregion first**, then province/state when useful. No conversational prefixes.
- **Geographic scope:** Prefer places **within or adjacent** to the implied province/state from hints and market; do not invent unrelated geography.
- If **Wikipedia intros** are present, use them only to ground **names**.`;
}

/** Footer bullets (manual mode) - broad scope only. */
export function buildSapEntityFooterManualBroad(level: EntityGeographicLevel): string {
  if (level === "national") {
    return `- **Per-target optional entity hint:** Prioritize hinted geography. Output "entity" at **national scale** when \`sapPages\` > 1 use **distinct** major place types (capitals, metros, regions, national parks).
- **"entity" label:** Named place or region first; no \`Near\` / \`Around\` prefixes.
- **Geographic scope (manual):** No rank grid - use hints, market, and Wikipedia to pick **plausible** national-scale entities. Do not duplicate the same \`entity\` on two rows.
- **Wikipedia:** Use intros only to ground names.`;
  }
  return `- **Per-target optional entity hint:** Prioritize hints. Output "entity" at **provincial / state scale**; when \`sapPages\` > 1 use **distinct** regional cities, subregions, parks, or corridors.
- **"entity" label:** Named place first; no conversational prefixes.
- **Geographic scope (manual):** Places should fit the implied **province or state** from hints and market.
- **Wikipedia:** Use intros only to ground names.`;
}

/** Phrase after "Optional user entity focus" in targets block (hint present). */
export function targetsBlockOptionalEntityOutputPhrase(level: EntityGeographicLevel): string {
  switch (level) {
    case "national":
      return 'Output "entity" as **national-scale geography** (major city, metro, named region, national park, or corridor), comma-separated; add province/state or country when needed.';
    case "provincial":
      return 'Output "entity" as **provincial- or state-scale geography** (regional city, subregion, provincial park, corridor), comma-separated; add province/state when needed.';
    default:
      return 'Output "entity" as **hyperlocal place first** (not city-first), then city, then province/state when needed.';
  }
}

/** Single-seed target line: how to differentiate entities (middle clause). */
export function singleSeedEntityDifferentiationClause(level: EntityGeographicLevel): string {
  switch (level) {
    case "national":
      return `**distinct \`entity\` values** at **national scale** (capital cities, major metros, named regions, national parks, major corridors) grounded in hints and evidence. **Do not** output different \`keyword\` strings per row.`;
    case "provincial":
      return `**distinct \`entity\` values** at **provincial or state scale** (regional cities, county seats, subregions, provincial parks, corridors) grounded in hints and evidence. **Do not** output different \`keyword\` strings per row.`;
    default:
      return `**distinct \`entity\` values**: use **different neighbourhood- or district-scale first segments** (or finer) within the same metro as the optional entity hint, grounded in the grid evidence. **Do not** output different \`keyword\` strings per row.`;
  }
}

/** Cluster anchor line: distinct entity instruction (non–single-seed, multi-row). */
export function clusterAnchorDistinctEntityClause(level: EntityGeographicLevel): string {
  switch (level) {
    case "national":
      return `**Each row must use a different \`entity\`** - pick **distinct national-scale** first segments (major cities, regions, national parks, corridors) appropriate to the business and grid or hints.`;
    case "provincial":
      return `**Each row must use a different \`entity\`** - pick **distinct provincial-scale** first segments (regional cities, subregions, parks, corridors) appropriate to the business and grid or hints.`;
    default:
      return `**Each row must use a different \`entity\`** - pick **distinct** first-segment area names from the grid's **Nearby place names** / cluster POIs / weak-rank points (never the same \`City, Province\` shortcut twice when the scan lists multiple areas).`;
  }
}

/** Title rule 3 line for broad geographic scope. */
export function sapTitleRule3ForBroadLevel(level: EntityGeographicLevel): string {
  if (level === "national") {
    return `3. **Lead with the primary geography:** When \`entity\` names a **city, region, or park**, the headline should feature that **first-segment** name clearly - not only a generic country reference.`;
  }
  return `3. **Lead with the primary geography:** When \`entity\` names a **city or subregion**, the headline should feature that place clearly - not only a generic province label.`;
}
