import { urlPathTail } from "@/lib/sitemap-optimizer/build-cluster-catalog-payload";
import { leadingPlaceKeyFromPathTail } from "@/lib/sitemap-optimizer/enforce-separate-geo-clusters";

function splitSlugParts(tail: string): string[] {
  return tail
    .trim()
    .toLowerCase()
    .replace(/\/$/, "")
    .split("-")
    .filter(Boolean);
}

function pathTail(input: string): string {
  return input.includes("://") ? urlPathTail(input) : input;
}

/**
 * Bucket for redirect-family geo grouping metadata sent to OpenRouter.
 * `{city}-seo-{neighborhood}-{city}` slugs group by city, not full slug.
 */
export function entityRedirectGroupingKey(urlOrPathTail: string): string {
  const tail = pathTail(urlOrPathTail);
  const parts = splitSlugParts(tail);
  const seoIdx = parts.indexOf("seo");
  if (seoIdx > 0) {
    return parts[0]!;
  }
  const leading = leadingPlaceKeyFromPathTail(tail);
  if (leading) return leading;
  return tail || "unknown";
}

/** Hyperlocal token from service-area slug when present. */
export function entityNeighborhoodFromPathTail(urlOrPathTail: string): string | null {
  const tail = pathTail(urlOrPathTail);
  const parts = splitSlugParts(tail);
  const seoIdx = parts.indexOf("seo");
  if (seoIdx >= 0) {
    let i = seoIdx + 1;
    if (parts[i] === "near") i += 1;
    const place: string[] = [];
    const cityToken = parts[0] ?? "";
    while (i < parts.length) {
      const token = parts[i]!;
      if (token === cityToken && place.length > 0) break;
      if (token === "visibility" || token === "solutions") {
        i += 1;
        continue;
      }
      place.push(token);
      i += 1;
    }
    while (place.length && place[place.length - 1] === cityToken) place.pop();
    return place.length ? place.join("-") : null;
  }
  return leadingPlaceKeyFromPathTail(tail);
}

export function titleCaseSlugToken(token: string): string {
  const t = token.trim();
  if (!t) return "";
  return t
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
