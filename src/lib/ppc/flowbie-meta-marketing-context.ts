import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import { getFlowbieMetaProgramBrief } from "@/lib/ppc/load-flowbie-meta-program-brief";
import type { MetaAdContextSource, MetaAdRow } from "@/lib/ppc/meta-ads-types";
import { resolveMetaRowContextSource, resolveMetaRowContextUrl } from "@/lib/ppc/meta-ads-types";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import { DEFAULT_TEAM_NAME } from "@/lib/teams-types";

export const FLOWBIE_PRODUCT_URL = "https://flowbie.ca/flowbie";
export const NEO_DIGITAL_DEMO_URL = "https://neodigital.ca/";

function flowbieMetaLandingUrlKey(url: string | null | undefined): string {
  return normalizePageUrlKey((url ?? "").trim());
}

export const FLOWBIE_META_LANDING_PAGES: readonly PpcWpPageContext[] = [
  {
    url: FLOWBIE_PRODUCT_URL,
    title: "FlowbieONE app",
    keyword: "FlowbieONE AI content flow manager",
    excerpt: "AI content and flow manager for WordPress.",
    metaDescription: "FlowbieONE turns Search Console signals into action lists tied to WordPress URLs.",
  },
  {
    url: NEO_DIGITAL_DEMO_URL,
    title: "Neo Digital demo",
    keyword: "WordPress SEO agency demo",
    excerpt: "Book a demo with Neo Digital Inc.",
    metaDescription: "WordPress SEO agency workflows with FlowbieONE.",
  },
];

const FLOWBIE_META_LANDING_URL_KEYS = new Set(
  FLOWBIE_META_LANDING_PAGES.map((page) => flowbieMetaLandingUrlKey(page.url)),
);

export function isFlowbieProductLandingUrl(url: string | null | undefined): boolean {
  return flowbieMetaLandingUrlKey(url) === flowbieMetaLandingUrlKey(FLOWBIE_PRODUCT_URL);
}

export function isFlowbieMetaStaticLandingUrl(url: string | null | undefined): boolean {
  const key = flowbieMetaLandingUrlKey(url);
  return Boolean(key) && FLOWBIE_META_LANDING_URL_KEYS.has(key);
}

export function findFlowbieMetaStaticLandingPage(
  url: string | null | undefined,
): PpcWpPageContext | undefined {
  const key = flowbieMetaLandingUrlKey(url);
  if (!key) return undefined;
  return FLOWBIE_META_LANDING_PAGES.find((page) => flowbieMetaLandingUrlKey(page.url) === key);
}

export function appendFlowbieMetaStaticPages(
  pages: PpcWpPageContext[],
  teamName: string | null | undefined,
): PpcWpPageContext[] {
  if (!isNeoDigitalAgencyTeam(teamName)) return pages;
  const seen = new Set(pages.map((page) => flowbieMetaLandingUrlKey(page.url)));
  const extras = FLOWBIE_META_LANDING_PAGES.filter(
    (page) => !seen.has(flowbieMetaLandingUrlKey(page.url)),
  ).map((page) => ({ ...page }));
  return extras.length ? [...extras, ...pages] : pages;
}

export function appendFlowbieMetaStaticPagesForGenerate(
  pages: PpcWpPageContext[],
  teamName: string | null | undefined,
  landingPageUrl?: string | null,
): PpcWpPageContext[] {
  if (isNeoDigitalAgencyTeam(teamName) || isFlowbieMetaStaticLandingUrl(landingPageUrl)) {
    return appendFlowbieMetaStaticPages(pages, "Neo Digital Inc.");
  }
  return pages;
}

/** FlowbieONE product program brief for Meta ad context (static markdown, not codebase). */
export function getFlowbieProductCodebaseContextBlock(): string {
  return getFlowbieMetaProgramBrief();
}

export function buildMetaPageContextForGenerate(
  page: PpcWpPageContext | undefined,
  landingPageUrl: string | null | undefined,
): string {
  if (isFlowbieProductLandingUrl(landingPageUrl) || isFlowbieProductLandingUrl(page?.url)) {
    return getFlowbieProductCodebaseContextBlock();
  }
  if (!page) return "No landing page context available.";
  return [
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    page.keyword ? `Keyword: ${page.keyword}` : "",
    page.metaDescription ? `Meta description: ${page.metaDescription}` : "",
    page.excerpt ? `Excerpt: ${page.excerpt.slice(0, 600)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function metaRowHasGenerateInput(
  row: Pick<MetaAdRow, "focusKeyword" | "contextSource" | "contextUrl" | "landingPageUrl">,
): boolean {
  if (row.focusKeyword?.trim()) return true;
  if (resolveMetaRowContextSource(row) === "flowbie_app") return true;
  const contextUrl = resolveMetaRowContextUrl(row);
  return /^https?:\/\//i.test(contextUrl);
}

export function metaJobsNeedPageBucket(
  jobs: ReadonlyArray<{
    contextSource?: MetaAdContextSource | null;
    contextUrl?: string | null;
    landingPageUrl?: string | null;
  }>,
): boolean {
  return jobs.some((job) => {
    const source = job.contextSource === "flowbie_app" ? "flowbie_app" : "custom";
    if (source === "flowbie_app") return false;
    const contextUrl = source === "flowbie_app" ? FLOWBIE_PRODUCT_URL : job.contextUrl?.trim() ?? "";
    if (/^https?:\/\//i.test(contextUrl)) return false;
    return !isFlowbieProductLandingUrl(job.landingPageUrl);
  });
}

export function getFlowbieMetaPickerPages(): PpcWpPageContext[] {
  return FLOWBIE_META_LANDING_PAGES.map((page) => ({ ...page }));
}

export function isNeoDigitalAgencyTeam(teamName: string | null | undefined): boolean {
  const normalized = (teamName ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === DEFAULT_TEAM_NAME.trim().toLowerCase() ||
    normalized === "neo digital inc" ||
    normalized.startsWith("neo digital")
  );
}

export function getNeoDigitalAgencyPovContextBlock(): string {
  return [
    "Neo Digital agency ad voice (we provide the service):",
    "Advertiser is Neo Digital Inc, a WordPress SEO and web design agency.",
    "Write in first person: we, our, us. Neo Digital offers help, audits, design, and implementation.",
    "Do NOT write as anonymous tips, courses, or third-party tools.",
    "Bad: Master Elementor design help. Good: We fix Elementor sites, Our Edmonton SEO team.",
    "Bad: We help Edmonton businesses (no outcome). Good: We help Edmonton get found, Edmonton SEO that ranks.",
    "On-image headline max 6 words from agency POV with a clear outcome, e.g. We help Edmonton rank, Our SEO audits fix gaps.",
  ].join("\n");
}

/** Compact Flowbie product + Instagram ad rules for Neo Digital harness steps. */
export function getFlowbieMetaMarketingContextBlock(): string {
  return [
    "FlowbieONE marketing context (Neo Digital agency only):",
    `Product URL: ${FLOWBIE_PRODUCT_URL}`,
    `Agency demo CTA URL: ${NEO_DIGITAL_DEMO_URL}`,
    "On-image copy limit: one short headline (max 6 words) plus optional 3 to 5 word subline. Body copy and captions live in Meta ad fields only.",
    "Visual style: white or light studio backgrounds, photo-real props and UI vignettes on white, accent #84BC00 as small UI highlight only, no logos.",
    "Funnel examples: BOFU action lists for WordPress SEO, MOFU agency scale, TOFU local search awareness.",
    "Reference: marketing/instagram-ads in the Flowbie codebase (feed creatives, minimal on-image text).",
  ].join("\n");
}

export function appendFlowbieMetaMarketingContext(
  systemPrompt: string,
  teamName: string | null | undefined,
  options?: { contextSource?: MetaAdContextSource | null },
): string {
  if (!isNeoDigitalAgencyTeam(teamName)) return systemPrompt;
  const blocks = [getFlowbieMetaMarketingContextBlock()];
  const source = options?.contextSource === "flowbie_app" ? "flowbie_app" : "custom";
  if (source !== "flowbie_app") {
    blocks.push(getNeoDigitalAgencyPovContextBlock());
  }
  return `${systemPrompt}\n\n${blocks.join("\n\n")}`;
}
