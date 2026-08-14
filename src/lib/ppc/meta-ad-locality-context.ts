import { parseCityRegionFromLooseLabel } from "@/lib/gmb-dfs-parse";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";

export type MetaAdLocalityContext = {
  city: string;
  region: string;
  hasLocality: boolean;
};

const NON_CITY_TOKENS = new Set([
  "seo",
  "ai",
  "aiseo",
  "ai-seo",
  "local",
  "marketing",
  "digital",
  "agency",
  "services",
  "service",
  "business",
  "businesses",
  "search",
  "google",
  "wordpress",
  "web",
  "design",
  "the",
  "and",
  "for",
  "your",
  "our",
  "inc",
  "llc",
  "ltd",
  "corp",
  "canada",
  "usa",
  "uk",
]);

function titleCaseCity(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isLikelyCityToken(token: string): boolean {
  const lower = token.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!lower || lower.length < 3) return false;
  if (NON_CITY_TOKENS.has(lower)) return false;
  if (/^\d+$/.test(lower)) return false;
  return /^[a-z][a-z'-]*$/i.test(token.trim());
}

/** Trailing city from "AI SEO Edmonton" or "Rank Higher in Edmonton". */
export function extractCityFromLooseText(text: string | undefined | null): string {
  const trimmed = text?.trim();
  if (!trimmed) return "";

  const commaParsed = parseCityRegionFromLooseLabel(trimmed);
  if (commaParsed.city && isLikelyCityToken(commaParsed.city)) {
    return titleCaseCity(commaParsed.city);
  }

  const inMatch = trimmed.match(/\bin\s+([A-Za-z][A-Za-z\s'-]{2,})\s*$/i);
  if (inMatch?.[1]) {
    const city = inMatch[1].trim().split(/\s+/).pop() ?? "";
    if (isLikelyCityToken(city)) return titleCaseCity(city);
  }

  const tokens = trimmed.split(/[\s,:/|–-]+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i] ?? "";
    if (isLikelyCityToken(token)) {
      return titleCaseCity(token);
    }
  }

  return "";
}

export function resolveMetaAdLocalityContext(options: {
  focusKeyword?: string;
  adName?: string;
  landingPage?: PpcWpPageContext;
  masterRulesCity?: string;
}): MetaAdLocalityContext {
  const sources = [
    options.masterRulesCity,
    extractCityFromLooseText(options.focusKeyword),
    extractCityFromLooseText(options.adName),
    extractCityFromLooseText(options.landingPage?.title),
    extractCityFromLooseText(options.landingPage?.keyword),
  ];

  for (const source of sources) {
    const trimmed = source?.trim();
    if (!trimmed) continue;
    const parsed = parseCityRegionFromLooseLabel(trimmed);
    const city = titleCaseCity(parsed.city || trimmed);
    if (city) {
      return {
        city,
        region: parsed.region?.trim() ?? "",
        hasLocality: true,
      };
    }
  }

  return { city: "", region: "", hasLocality: false };
}

export function buildMetaCitySceneQuery(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) return "";
  return `${trimmed} skyline cityscape`;
}
