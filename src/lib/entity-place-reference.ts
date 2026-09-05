import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";
import {
  keywordPlaceSuffixFromEntity,
  stripAllPlaceTokensFromKeyword,
} from "@/lib/local-analysis/entity-sap-row-keyword-fill";
import { entityPhraseCandidates } from "@/lib/overview/overview-blog-wikipedia-link-insert";

export type EntityPlaceParts = {
  /** Normalized comma label from brief / SAP row (e.g. "Lacombe Park, St. Albert, AB"). */
  canonical: string;
  neighborhood: string;
  city: string;
  province: string;
  /** Prose label without province (e.g. "Lacombe Park, St. Albert"). */
  proseLabel: string;
  /** SEO slug suffix — forbidden in body copy (e.g. "Lacombe Park St Albert"). */
  slugSuffixForbidden: string;
};

/** Split SAP entity comma label into neighborhood, city, and province. Entity only — no service-area inference. */
export function parseEntityPlaceParts(entity: string): EntityPlaceParts {
  const canonical = normalizeEntityHintCommaLabel(entity.trim());
  const parts = canonical
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let province = "";
  let withoutProvince = [...parts];
  if (parts.length >= 2 && /^[A-Za-z]{2}$/.test(parts[parts.length - 1]!)) {
    province = parts[parts.length - 1]!;
    withoutProvince = parts.slice(0, -1);
  }

  let neighborhood = "";
  let city = "";
  if (withoutProvince.length >= 2) {
    neighborhood = withoutProvince[0]!;
    city = withoutProvince[1]!;
  } else if (withoutProvince.length === 1) {
    city = withoutProvince[0]!;
  }

  const proseLabel = withoutProvince.join(", ");

  return {
    canonical,
    neighborhood,
    city,
    province,
    proseLabel,
    slugSuffixForbidden: keywordPlaceSuffixFromEntity(canonical),
  };
}

function placeLabelsForKeywordStrip(entity: string): string[] {
  const parts = parseEntityPlaceParts(entity);
  const raw = [
    parts.canonical,
    parts.proseLabel,
    parts.slugSuffixForbidden,
    keywordPlaceSuffixFromEntity(parts.canonical),
    parts.neighborhood,
    parts.city,
  ].filter(Boolean);
  const out = new Set<string>();
  for (const label of raw) {
    out.add(label);
    out.add(label.replace(/\./g, " ").replace(/\s+/g, " ").trim());
  }
  return [...out];
}

/** Service-only topic for prose. Strips place tokens from focus keyword using entity comma label only. */
export function resolveServiceTopicKeyword(keyword: string, entity: string): string {
  const ent = normalizeEntityHintCommaLabel(entity.trim());
  const kw = keyword.trim().replace(/\./g, " ").replace(/\s+/g, " ").trim();
  if (!kw || !ent) return "";
  return stripAllPlaceTokensFromKeyword(kw, placeLabelsForKeywordStrip(ent)).trim();
}

/**
 * Mandatory place reference block from brief entity — comma grammar, not slug stacks.
 */
export function formatEntityReferencePromptBlock(input: {
  entity: string;
  keyword?: string;
}): string {
  const parts = parseEntityPlaceParts(input.entity);
  if (!parts.canonical) return "";

  const serviceTopic = input.keyword?.trim()
    ? resolveServiceTopicKeyword(input.keyword, parts.canonical)
    : "";
  const allowed = entityPhraseCandidates(parts.proseLabel);
  if (parts.neighborhood && parts.city) {
    allowed.unshift(`homeowners in ${parts.neighborhood}, ${parts.city}`);
  }

  const forbiddenExamples: string[] = [];
  if (parts.slugSuffixForbidden) {
    forbiddenExamples.push(`"${parts.slugSuffixForbidden}" (no comma between place segments)`);
  }
  if (serviceTopic && parts.slugSuffixForbidden) {
    forbiddenExamples.push(`"${serviceTopic} ${parts.slugSuffixForbidden}"`);
    forbiddenExamples.push(`"the perfect ${serviceTopic} ${parts.slugSuffixForbidden} needs"`);
  }

  const lines = [
    "--- PLACE ENTITY (MANDATORY — from research brief / SAP row) ---",
    `Canonical entity: ${parts.canonical}`,
    `Prose label: ${parts.proseLabel}`,
    parts.neighborhood ? `Neighborhood: ${parts.neighborhood}` : "",
    parts.city ? `City: ${parts.city}` : "",
    serviceTopic ? `Service topic (prose): ${serviceTopic}` : "",
    "",
    "Refer to the place only with comma grammar from the entity label above.",
    "Allowed reference forms (vary naturally):",
    ...allowed.slice(0, 8).map((p) => `- "${p}"`),
    "",
    "Forbidden in body copy:",
    "- Concatenating neighborhood + city without a comma (slug-style place names)",
    "- Repeating the full SEO focus keyword with every place mention when it embeds location tokens",
    ...forbiddenExamples.map((f) => `- ${f}`),
    "--- END PLACE ENTITY ---",
  ];

  return lines.filter(Boolean).join("\n");
}

/** Prose entity label without province. */
export function entityLabelForProse(entity: string): string {
  return parseEntityPlaceParts(entity).proseLabel;
}
