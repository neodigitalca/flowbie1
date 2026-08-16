import type { WordPressSite } from "@/components/integrations/types";
import { isInventoryExcludedSitemapUrl } from "@/lib/bulk/inventory-url-filter";
import { fetchOverviewInventoryForSource } from "@/lib/overview/overview-parallel-inventory-fetch";
import { isOverviewUtilityPage } from "@/lib/overview/overview-utility-page-filter";
import {
  mapOverviewRowToPpcWpPageContext,
  type PpcPageBucketHostedLink,
  createPpcPageBucketHostedLink,
  revokePpcPageBucketHostedLink,
} from "@/lib/ppc/ppc-page-bucket-inventory";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import type { SocialLandingPageSource } from "@/lib/social/content-creator-types";

export { createPpcPageBucketHostedLink, revokePpcPageBucketHostedLink };
export type { PpcPageBucketHostedLink };

const EXCLUDED_PATH_SNIPPETS = [
  "career",
  "elementor",
  "thank-you",
  "thankyou",
  "style-guide",
  "/style/",
] as const;

function pathSegments(url: string): string[] {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

function lastSegment(url: string): string {
  const segments = pathSegments(url);
  return (segments[segments.length - 1] ?? "").toLowerCase();
}

/** Content Creator: skip careers, thank-you, Elementor/style templates, and other utility pages. */
export function isContentCreatorExcludedLandingPage(input: {
  url?: string;
  slug?: string;
  title?: string;
}): boolean {
  const url = typeof input.url === "string" ? input.url : "";
  if (!url || isInventoryExcludedSitemapUrl(url)) return true;
  if (isOverviewUtilityPage(input)) return true;

  const pathLower = url.toLowerCase();
  for (const snippet of EXCLUDED_PATH_SNIPPETS) {
    if (pathLower.includes(snippet)) return true;
  }

  const slug = (typeof input.slug === "string" ? input.slug : lastSegment(url)).toLowerCase();
  if (slug === "careers" || slug === "career") return true;
  if (slug.startsWith("elementor")) return true;

  return false;
}

function dedupePagesByUrl(pages: PpcWpPageContext[]): PpcWpPageContext[] {
  const seen = new Set<string>();
  const out: PpcWpPageContext[] = [];
  for (const page of pages) {
    const key = normalizePageUrlKey(page.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(page);
  }
  return out;
}

function shufflePages(pages: PpcWpPageContext[]): PpcWpPageContext[] {
  const copy = [...pages];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function mapInventoryRows(
  rows: Awaited<ReturnType<typeof fetchOverviewInventoryForSource>>["rows"],
): PpcWpPageContext[] {
  return dedupePagesByUrl(
    rows
      .filter(
        (row) =>
          !isContentCreatorExcludedLandingPage({
            url: typeof row.url === "string" ? row.url : undefined,
            slug: typeof row.slug === "string" ? row.slug : undefined,
            title: typeof row.fields?.title === "string" ? row.fields.title : undefined,
          }),
      )
      .map(mapOverviewRowToPpcWpPageContext)
      .filter((page): page is PpcWpPageContext => Boolean(page)),
  );
}

export async function loadContentCreatorLandingPages(
  site: WordPressSite,
  source: SocialLandingPageSource = "random",
): Promise<PpcWpPageContext[]> {
  const username = typeof site.username === "string" ? site.username : "";
  const appPassword = typeof site.appPassword === "string" ? site.appPassword : "";
  if (!username || !appPassword) {
    throw new Error("WordPress credentials are required to load page inventory.");
  }

  const fetchPages = fetchOverviewInventoryForSource(site, "pages", { includeScheduled: true });
  const fetchPosts = fetchOverviewInventoryForSource(site, "posts", { includeScheduled: true });

  let pages: PpcWpPageContext[];
  let errors: Record<string, string | undefined>;

  if (source === "pages") {
    const pagesResult = await fetchPages;
    pages = mapInventoryRows(pagesResult.rows);
    errors = pagesResult.errors;
  } else if (source === "posts") {
    const postsResult = await fetchPosts;
    pages = mapInventoryRows(postsResult.rows);
    errors = postsResult.errors;
  } else {
    const [pagesResult, postsResult] = await Promise.all([fetchPages, fetchPosts]);
    pages = shufflePages(mapInventoryRows([...pagesResult.rows, ...postsResult.rows]));
    errors = { ...pagesResult.errors, ...postsResult.errors };
  }

  if (!pages.length) {
    const errText = Object.values(errors).filter(Boolean).join(" · ");
    throw new Error(errText || "Site inventory returned no content landing pages.");
  }

  return pages;
}
