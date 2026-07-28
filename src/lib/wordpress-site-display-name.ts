import type { WordPressSite } from "@/components/integrations/types";

/** Trailing " ..." from legacy ~60-char title chops — not part of the real business name. */
function isLikelyTruncatedStoredName(name: string): boolean {
  return / \.\.\.$/.test(name.trim());
}

/**
 * Best label for property rows. Prefers full NAP / GBP name when stored `site.name`
 * was saved with an artificial trailing ellipsis.
 */
export function wordpressSiteDisplayName(site: WordPressSite): string {
  const stored = site.name.trim();
  const nap = site.napInfo?.name?.trim() ?? "";

  if (nap) {
    if (isLikelyTruncatedStoredName(stored)) return nap;
    const storedCore = stored.replace(/ \.\.\.$/, "").trim();
    if (nap.length > storedCore.length) return nap;
  }

  if (isLikelyTruncatedStoredName(stored)) {
    return stored.replace(/ \.\.\.$/, "").trim();
  }

  return stored;
}
