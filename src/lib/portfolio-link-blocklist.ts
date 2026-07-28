import type { WordPressSite } from "@/components/integrations/types";

function canonicalHost(hostname: string): string {
  return (hostname || "").toLowerCase().replace(/^www\./, "");
}

/**
 * Naive registrable domain (last two labels). Matches server semrush-url-filter.js.
 */
function registrableDomainGuess(hostname: string): string {
  const h = canonicalHost(hostname);
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  return parts.slice(-2).join(".");
}

function hostnameFromSiteUrl(siteUrl: string): string | null {
  const s = (siteUrl || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    return u.hostname;
  } catch {
    return null;
  }
}

function normalizeSiteUrlKey(siteUrl: string): string {
  const s = (siteUrl || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = (u.pathname || "").replace(/\/+$/, "") || "";
    return `${host}${path}`;
  } catch {
    return s.toLowerCase().replace(/\/+$/, "");
  }
}

/**
 * Hostnames / registrable domains for every saved WordPress site except the one being optimized,
 * so Semrush reference URLs never point at another Flowbie client.
 */
export function buildPortfolioBlockedHosts(
  sites: WordPressSite[],
  options: { excludeSiteId?: string; excludeSiteUrl?: string },
): string[] {
  const excludeKey = options.excludeSiteUrl ? normalizeSiteUrlKey(options.excludeSiteUrl) : "";
  const set = new Set<string>();
  for (const s of sites) {
    if (options.excludeSiteId && s.id === options.excludeSiteId) continue;
    if (excludeKey) {
      if (normalizeSiteUrlKey(s.siteUrl || "") === excludeKey) continue;
      if (normalizeSiteUrlKey(s.productionSiteUrl || "") === excludeKey) continue;
    }
    for (const raw of [s.siteUrl, s.productionSiteUrl]) {
      const host = hostnameFromSiteUrl(raw || "");
      if (!host) continue;
      const c = canonicalHost(host);
      if (!c) continue;
      set.add(c);
      set.add(registrableDomainGuess(c));
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "en"));
}
