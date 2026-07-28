/**
 * Global pages-bucket hub paths (any site): index/listing pages, not nested child URLs.
 * Matches single-segment paths only — e.g. excludes /blog/ but keeps /blog/my-post/.
 */
export const OVERVIEW_EXCLUDED_PAGE_HUB_SLUGS = [
  "blog",
  "faq",
  "faqs",
  "service-area",
  "service-areas",
] as const;

/** Slugs / path tails for legal, nav, hub, and non-content WordPress pages. */
const UTILITY_PAGE_SLUGS = new Set(
  [
    ...OVERVIEW_EXCLUDED_PAGE_HUB_SLUGS,
    "privacy-policy",
    "privacy",
    "terms-of-service",
    "terms-of-use",
    "terms-and-conditions",
    "terms-conditions",
    "terms",
    "cookie-policy",
    "cookies",
    "table-of-contents",
    "toc",
    "thank-you",
    "thankyou",
    "disclaimer",
    "accessibility",
    "legal",
    "gdpr",
    "returns-policy",
    "refund-policy",
    "sitemap",
    "site-map",
    "contact",
    "contact-us",
    "promotion",
    "promotions",
    "free-consultation",
    "locations",
  ].map((s) => s.toLowerCase()),
);

/** Single-segment hub URLs (e.g. /blog/, /contact/) — not nested service/location pages. */
const UTILITY_HUB_SLUGS = new Set(
  [
    ...OVERVIEW_EXCLUDED_PAGE_HUB_SLUGS,
    "contact",
    "contact-us",
    "faq",
    "faqs",
    "promotion",
    "promotions",
    "service-area",
    "service-areas",
    "locations",
    "terms-conditions",
    "terms-and-conditions",
    "privacy-policy",
    "free-consultation",
  ].map((s) => s.toLowerCase()),
);

const UTILITY_PAGE_TITLE_PHRASES = [
  "privacy policy",
  "terms of service",
  "terms of use",
  "terms and conditions",
  "terms & conditions",
  "cookie policy",
  "table of contents",
  "thank you",
  "disclaimer",
  "accessibility statement",
  "legal notice",
  "refund policy",
  "return policy",
  "site map",
  "contact us",
  "frequently asked",
];

function decodeUtilityText(text: string): string {
  return text
    .replace(/&#0*38;/gi, "&")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'");
}

function pathSegments(url: string): string[] {
  try {
    return new URL(url.trim()).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

function lastPathSegment(url: string): string {
  const segments = pathSegments(url);
  return (segments[segments.length - 1] ?? "").toLowerCase();
}

function slugMatchesUtility(slug: string): boolean {
  const s = slug.toLowerCase().trim();
  if (!s) return false;
  if (UTILITY_PAGE_SLUGS.has(s)) return true;
  if (s.includes("terms")) return true;
  if (s.includes("thank-you") || s.includes("thankyou")) return true;
  if (s.includes("privacy")) return true;
  if (s.includes("cookie")) return true;
  if (s.includes("table-of-contents") || s === "toc") return true;
  return false;
}

function isGlobalPagesBucketHubUrl(url: string): boolean {
  const segments = pathSegments(url);
  if (segments.length !== 1) return false;
  const hub = segments[0]!.toLowerCase();
  return (OVERVIEW_EXCLUDED_PAGE_HUB_SLUGS as readonly string[]).includes(hub);
}

function urlPathMatchesUtility(url: string): boolean {
  if (isGlobalPagesBucketHubUrl(url)) return true;
  const segments = pathSegments(url);
  if (!segments.length) return false;
  const last = segments[segments.length - 1]?.toLowerCase() ?? "";
  if (last && slugMatchesUtility(last)) return true;
  if (segments.length === 1 && UTILITY_HUB_SLUGS.has(segments[0]!.toLowerCase())) return true;
  return false;
}

function titleMatchesUtility(title: string): boolean {
  const t = decodeUtilityText(title).toLowerCase().trim();
  if (!t) return false;
  return UTILITY_PAGE_TITLE_PHRASES.some((phrase) => t.includes(phrase));
}

/** True for legal, TOC, thank-you, contact/FAQ/blog hubs, and other non-service WordPress pages. */
export function isOverviewUtilityPage(input: {
  url?: string;
  slug?: string;
  title?: string;
}): boolean {
  const slug = (input.slug ?? "").trim();
  if (slug && slugMatchesUtility(slug)) return true;

  const url = (input.url ?? "").trim();
  if (url && urlPathMatchesUtility(url)) return true;

  const title = (input.title ?? "").trim();
  if (title && titleMatchesUtility(title)) return true;

  return false;
}

export function filterOverviewUtilityInventoryRows<T extends {
  url?: string;
  slug?: string;
  fields?: { title?: string };
  collection?: string;
}>(rows: T[]): T[] {
  return rows.filter((row) => {
    const coll = (row.collection ?? "").toLowerCase().trim();
    if (coll && coll !== "pages" && coll !== "page") return true;
    return !isOverviewUtilityPage({
      url: row.url,
      slug: row.slug,
      title: row.fields?.title,
    });
  });
}

export function filterOverviewUtilityUrls(urls: string[]): string[] {
  return urls.filter((url) => !isOverviewUtilityPage({ url }));
}
