/** Schema / example echoes that must never ship as SAP entity, keyword, or modifier. */

const PLACEHOLDER_ENTITY_EXACT = new Set(
  [
    "hyperlocal place, city",
    "place, city",
    "example, city",
    "service area",
    "neighborhood",
    "city, state",
    "local place",
  ].map((s) => s.toLowerCase()),
);

const PLACEHOLDER_FIELD_PREFIXES = [
  "geography-free phrase",
  "headline with keyword",
  "120-160 char meta",
  "writer brief grounded",
  "why this replacement",
  "h2 one",
  "from legacy content",
  "from legacy themes",
];

export function isPlaceholderSapEntity(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  if (PLACEHOLDER_ENTITY_EXACT.has(lower)) return true;
  if (lower.includes("hyperlocal place")) return true;
  if (lower === "place" || lower === "city") return true;
  return false;
}

export function isPlaceholderStrategyField(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  if (isPlaceholderSapEntity(t)) return true;
  return PLACEHOLDER_FIELD_PREFIXES.some((p) => lower.startsWith(p) || lower.includes(p));
}

export function isPlaceholderKeyword(value: string | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  if (lower === "local service") return true;
  return isPlaceholderStrategyField(t);
}
