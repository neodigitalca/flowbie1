const LEGAL_SUFFIXES = /(?:llp|llc|inc|corp|ltd|cpa|ca|consulting|group|firm|co)$/i;

/** Derive brand tokens from a site hostname (no hardcoded firm names). */
export function brandTokensFromSiteUrl(siteUrl: string): string[] {
  const tokens = new Set<string>();
  const raw = siteUrl.trim();
  if (!raw) return [];

  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    const stem = host.split(".")[0] ?? "";
    if (stem.length >= 2) tokens.add(stem);

    const stripped = stem.replace(LEGAL_SUFFIXES, "");
    if (stripped.length >= 2 && stripped !== stem) tokens.add(stripped);

    for (const part of stem.split(/[^a-z0-9]+/)) {
      if (part.length >= 3) tokens.add(part);
    }
  } catch {
    return [];
  }

  return [...tokens].filter((t) => t.length >= 2);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when a URL slug or title contains a site brand token as its own segment/token. */
export function textContainsSiteBrandToken(text: string, brandTokens: readonly string[]): boolean {
  const hay = text.toLowerCase();
  for (const token of brandTokens) {
    if (token.length < 3) continue;
    const re = new RegExp(`(^|[-_/\\s])${escapeRegExp(token)}([-_/\\s]|$)`, "i");
    if (re.test(hay)) return true;
  }
  return false;
}
