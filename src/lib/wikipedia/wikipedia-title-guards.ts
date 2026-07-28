import { isStateOrProvinceOnlyWikipediaTitle } from "@/lib/grid-entity-hint-breadth";
import { isListOrBroadIndexTitle } from "./entity-hint-subcity";

/** Two-word "Something culture" titles are often prehistoric anthropology (e.g. Armstrong culture), not service-area geography. */
function shouldDropTwoWordCultureTitle(title: string): boolean {
  const head = title.split(",")[0]!.trim();
  const parts = head.split(/\s+/).filter(Boolean);
  if (parts.length !== 2 || parts[1]!.toLowerCase() !== "culture") return false;
  const firstLower = parts[0]!.toLowerCase();
  const keepModern = new Set([
    "pop",
    "youth",
    "mass",
    "internet",
    "car",
    "work",
    "food",
    "coffee",
    "wine",
    "beer",
    "startup",
    "corporate",
    "consumer",
    "political",
    "visual",
    "oral",
    "written",
    "folk",
    "drinking",
    "drug",
    "rape",
    "cancel",
    "honor",
    "shame",
    "material",
    "hip",
    "office",
    "kitchen",
    "sports",
    "rape",
    "hookup",
    "celebrity",
    "fan",
    "club",
  ]);
  if (keepModern.has(firstLower)) return false;
  return true;
}

/**
 * Deterministic drops for Wikipedia titles that are not modern community places for local SEO
 * (archaeology, NRHP list pages, rock art, culture-only topics). Aligns with the OpenRouter
 * community filter prompt in filter-wikipedia-titles-for-community-entity-openrouter.ts.
 */
export function filterNonCommunityWikipediaTitles(titles: string[]): string[] {
  return titles.filter((raw) => {
    const t = raw.trim();
    if (!t) return false;
    if (isStateOrProvinceOnlyWikipediaTitle(t)) return false;
    if (isListOrBroadIndexTitle(t)) return false;
    const l = t.toLowerCase();
    if (/\bdocumentation of\b/i.test(t)) return false;
    if (/\bmps\b/i.test(t)) return false;
    if (/\bnrhp\b/i.test(t)) return false;
    if (l.includes("hopewell tradition")) return false;
    if (l.includes("rock art")) return false;
    if (l.includes("american indian rock")) return false;
    if (l.includes("archaeological")) return false;
    if (l.includes("paleontological")) return false;
    if (l.includes("burial mound")) return false;
    /** NRHP / archaeological dig pages often titled "… Site". */
    if (/\bsite\s*$/i.test(t.trim())) return false;
    if (l.includes("armstrong culture")) return false;
    if (/\bearthwork(s)?\b/i.test(t)) return false;
    if (/\bexcavation\b/i.test(t)) return false;
    if (shouldDropTwoWordCultureTitle(t)) return false;
    if (/\b(prehistoric|paleo|paleolithic|woodland period|mississippian culture)\b/i.test(t)) return false;
    if (l.includes("disambiguation")) return false;
    if (/\(window\)\s*$/i.test(t)) return false;
    if (/\(sport\)\s*$/i.test(t)) return false;
    if (/\(film\)\s*$/i.test(t)) return false;
    return true;
  });
}
