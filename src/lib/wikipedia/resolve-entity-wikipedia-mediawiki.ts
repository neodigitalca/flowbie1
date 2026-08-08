import { checkWikipediaPageExists, searchWikipediaPages } from "./mediawiki-search";

const PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

export type EntityWikiHit = {
  url: string;
  title: string;
  /** Entity label used for lookup (may be broader than input). */
  matchLabel: string;
};

/** Most-specific-first labels to try against Wikipedia (then broader geography). */
export function entityWikiLookupCandidates(entity: string): string[] {
  const trimmed = entity.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const label = value.trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };

  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    for (let n = parts.length; n >= 1; n--) {
      push(parts.slice(0, n).join(", "));
    }
    if (parts.length >= 3) {
      const province = parts[2]!;
      const provinceName = PROVINCE_NAMES[province.toUpperCase()] ?? province;
      push(`${parts[1]}, ${provinceName}`);
      push(provinceName);
    }
    if (parts.length >= 2) {
      push(parts[1]!);
    }
    return out;
  }

  push(trimmed);
  const words = trimmed.split(/\s+/).filter(Boolean);
  for (let start = 1; start < words.length; start++) {
    push(words.slice(start).join(" "));
  }
  const lastWord = words[words.length - 1]?.toUpperCase();
  if (lastWord && PROVINCE_NAMES[lastWord]) {
    push(PROVINCE_NAMES[lastWord]!);
    if (words.length >= 2) {
      push(words[words.length - 2]!);
    }
  }
  return out;
}

async function firstWikiHitForLabel(label: string): Promise<EntityWikiHit | null> {
  const exact = await checkWikipediaPageExists(label);
  if (exact.exists && exact.url && exact.title) {
    return { url: exact.url, title: exact.title, matchLabel: label };
  }

  const titles = await searchWikipediaPages(label, 10);
  for (const title of titles) {
    const hit = await checkWikipediaPageExists(title);
    if (hit.exists && hit.url && hit.title) {
      return { url: hit.url, title: hit.title, matchLabel: label };
    }
  }
  return null;
}

/** Resolve English Wikipedia URL via API; walk up to broader geography when needed. */
export async function resolveEntityWikipediaMediaWiki(
  entity: string,
): Promise<EntityWikiHit | null> {
  const candidates = entityWikiLookupCandidates(entity);
  for (const label of candidates) {
    const hit = await firstWikiHitForLabel(label);
    if (hit) return hit;
  }
  return null;
}
