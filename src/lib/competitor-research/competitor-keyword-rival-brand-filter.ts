import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";
import type { CompetitorResearchSemrushResponse } from "@/lib/competitor-research/types";

/**
 * Tokens that appear in many dental/local domains but are not competitor-specific brands.
 * Do not treat these alone as rival-brand needles (avoids dropping "family dentist …").
 */
const GENERIC_NEEDLE_TOKEN = new Set([
  "dental",
  "dentistry",
  "dentist",
  "dentists",
  "clinic",
  "family",
  "care",
  "group",
  "associates",
  "orthodontics",
  "ortho",
  "health",
  "smile",
  "teeth",
  "tooth",
  "oral",
  "best",
  "top",
  "new",
  "city",
  "town",
  "north",
  "south",
  "east",
  "west",
  "central",
  "downtown",
  "metro",
  "area",
  "local",
  "near",
  "home",
  "plus",
  "pro",
]);

/** Strip trailing generic host suffixes repeatedly (orchardsdental → orchards). */
const HOST_GENERIC_SUFFIX = /(dentalclinic|dentistry|dentists?|dental|clinic|family|care|group|associates|orthodontics|ortho)$/i;

function stripGenericHostSuffixes(sld: string): string {
  let t = sld.toLowerCase();
  for (let i = 0; i < 10; i++) {
    const next = t.replace(HOST_GENERIC_SUFFIX, "");
    if (next === t || next.length < 2) break;
    t = next;
  }
  return t;
}

/**
 * Substrings that identify *this* competitor's brand from the registrable domain label
 * (e.g. orchardsdental.ca → orchards, orchardsdental). Used to drop navigational queries
 * like "orchards dental" from that competitor's organic list.
 */
export function extractRivalBrandNeedlesFromDomain(domain: string): string[] {
  const host = normalizeCompetitorDomainKey(domain);
  const sld = (host.split(".")[0] || "").toLowerCase();
  if (!sld) return [];

  const needles = new Set<string>();

  for (const seg of sld.split("-")) {
    if (seg.length >= 3 && !GENERIC_NEEDLE_TOKEN.has(seg)) needles.add(seg);
  }

  const spaced = sld.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  for (const w of spaced.split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !GENERIC_NEEDLE_TOKEN.has(w)) needles.add(w);
  }

  const core = stripGenericHostSuffixes(sld);
  if (core.length >= 3 && !GENERIC_NEEDLE_TOKEN.has(core)) needles.add(core);

  if (sld.length >= 4) needles.add(sld);

  return [...needles].sort((a, b) => b.length - a.length);
}

/** True if the phrase is a navigational / brand query for this competitor's domain. */
export function phraseMatchesCompetitorRivalBrand(phrase: string, domain: string): boolean {
  const needles = extractRivalBrandNeedlesFromDomain(domain);
  if (needles.length === 0) return false;

  const p = phrase.toLowerCase().replace(/\s+/g, " ").trim();
  if (p.length < 2) return false;
  const compact = p.replace(/[^a-z0-9]+/g, "");

  for (const n of needles) {
    if (n.length < 3) continue;
    if (p.includes(n)) return true;
    const nc = n.replace(/[^a-z0-9]+/g, "");
    if (nc.length >= 3 && compact.includes(nc)) return true;
  }
  return false;
}

/**
 * Removes per-competitor branded phrases from enrichment topKeywords before relevance / caps.
 * Does not use the client seed - only the row's domain.
 */
export function filterEnrichmentDropCompetitorBrandedKeywords(
  enrichment: CompetitorResearchSemrushResponse["enrichmentByDomain"],
): CompetitorResearchSemrushResponse["enrichmentByDomain"] {
  if (!enrichment) return enrichment;

  const out: NonNullable<typeof enrichment> = {};
  for (const [domain, enr] of Object.entries(enrichment)) {
    const top = (enr.topKeywords ?? []).filter(
      (r) => !phraseMatchesCompetitorRivalBrand(r.phrase || "", domain),
    );
    if (top.length > 0) {
      out[domain] = { ...enr, topKeywords: top };
    }
  }
  return out;
}
