import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";

export function linkUrlEqual(a: string, b: string): boolean {
  const left = (a ?? "").trim().toLowerCase().replace(/\/+$/, "");
  const right = (b ?? "").trim().toLowerCase().replace(/\/+$/, "");
  return Boolean(left && right && left === right);
}

export function normalizePlanLinkUrl(siteBaseUrl: string, url: string): string {
  return normalizeInternalUrl(siteBaseUrl, url);
}

/** Consultation / booking CTAs are never rewritten by Links. */
export function isProtectedBlogLinkHref(href: string): boolean {
  try {
    const path = new URL(href.startsWith("http") ? href : `https://x${href}`).pathname.toLowerCase();
    return /\/consultation\/?$/.test(path) || path.includes("/consultation/");
  } catch {
    return /consultation/i.test(href);
  }
}
