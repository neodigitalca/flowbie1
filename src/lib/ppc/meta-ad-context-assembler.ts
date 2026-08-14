import { buildMetaSeoContextBlock, fetchMetaAdSeoContext } from "@/lib/ppc/fetch-meta-ad-seo-context";
import {
  findFlowbieMetaStaticLandingPage,
  FLOWBIE_PRODUCT_URL,
  getNeoDigitalAgencyPovContextBlock,
  isNeoDigitalAgencyTeam,
} from "@/lib/ppc/flowbie-meta-marketing-context";
import { getFlowbieMetaProgramBriefMarkdown } from "@/lib/ppc/load-flowbie-meta-program-brief";
import type { PpcGscPageContext, PpcWpPageContext } from "@/lib/ppc/google-ads-types";
import type { MetaAdColorPalette, MetaAdContextSource } from "@/lib/ppc/meta-ads-types";
import { formatMetaColorPaletteBlock } from "@/lib/ppc/meta-ad-color-palette";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type MetaContextResearch = {
  url: string;
  pageContext: string;
  title: string;
  bodyText: string;
  markdown: string;
};

export function metaContextUrlsMatch(a: string, b: string): boolean {
  const left = normalizePageUrlKey(a.trim());
  const right = normalizePageUrlKey(b.trim());
  return Boolean(left) && left === right;
}

export async function loadMetaContextResearch(
  url: string,
  options?: { focusKeyword?: string; signal?: AbortSignal },
): Promise<MetaContextResearch> {
  const seo = await fetchMetaAdSeoContext(url, options);
  return {
    url: url.trim(),
    pageContext: seo.pageContext,
    title: seo.title,
    bodyText: seo.bodyText,
    markdown: seo.pageContext,
  };
}

export function loadMetaFlowbieAppContextResearch(): MetaContextResearch {
  const markdown = getFlowbieMetaProgramBriefMarkdown();
  return {
    url: "",
    pageContext: markdown,
    title: "FlowbieONE app",
    bodyText: markdown,
    markdown,
  };
}

export function metaFlowbieAppLandingPage(focusKeyword?: string): PpcWpPageContext {
  const page = findFlowbieMetaStaticLandingPage(FLOWBIE_PRODUCT_URL);
  return {
    url: page?.url ?? "",
    title: page?.title ?? "FlowbieONE app",
    keyword: focusKeyword?.trim() || page?.keyword,
    excerpt: page?.excerpt ?? getFlowbieMetaProgramBriefMarkdown().slice(0, 600),
    metaDescription: page?.metaDescription ?? "",
  };
}

export function buildMetaGscQueriesMarkdown(gsc?: PpcGscPageContext): string {
  if (!gsc?.queries?.length) return "";
  const lines = [
    "GSC queries (previous calendar month):",
    `URL: ${gsc.url}`,
    ...gsc.queries
      .slice(0, 20)
      .map((q) => `- ${q.query} (${q.impressions} impressions, pos ${q.position.toFixed(1)})`),
  ];
  return lines.join("\n");
}

export function buildMetaUnifiedContextBlock(options: {
  contextResearch?: MetaContextResearch | null;
  landingResearch?: MetaContextResearch | null;
  gscMarkdown?: string;
  focusKeyword?: string;
  contextSource: MetaAdContextSource;
  teamName?: string | null;
  imagePromptModifier?: string;
  colorPalette?: MetaAdColorPalette;
}): string {
  const sections: string[] = [];

  if (options.contextSource === "flowbie_app") {
    sections.push(`=== FlowbieONE program brief ===\n${getFlowbieMetaProgramBriefMarkdown()}`);
  } else if (options.contextResearch?.pageContext.trim()) {
    sections.push(`=== Context URL research ===\n${options.contextResearch.pageContext.trim()}`);
  }
  if (
    options.landingResearch?.pageContext.trim() &&
    (!options.contextResearch ||
      !metaContextUrlsMatch(options.contextResearch.url, options.landingResearch.url))
  ) {
    sections.push(`=== Landing page research ===\n${options.landingResearch.pageContext.trim()}`);
  }
  if (options.focusKeyword?.trim()) {
    sections.push(`Focus keyword: ${options.focusKeyword.trim()}`);
  }
  if (options.gscMarkdown?.trim()) {
    sections.push(options.gscMarkdown.trim());
  }
  if (isNeoDigitalAgencyTeam(options.teamName) && options.contextSource !== "flowbie_app") {
    sections.push(`=== Agency voice ===\n${getNeoDigitalAgencyPovContextBlock()}`);
  }
  if (options.imagePromptModifier?.trim()) {
    sections.push(`Campaign context:\n${options.imagePromptModifier.trim()}`);
  }
  const colorBlock = formatMetaColorPaletteBlock(options.colorPalette);
  if (colorBlock) {
    sections.push(colorBlock);
  }

  if (!sections.length) {
    return options.focusKeyword?.trim()
      ? `Focus keyword: ${options.focusKeyword.trim()}`
      : "No page context available.";
  }
  return sections.join("\n\n");
}

export function metaContextResearchToLandingPage(
  research: MetaContextResearch,
  focusKeyword?: string,
): PpcWpPageContext {
  return {
    url: research.url,
    title: research.title || focusKeyword?.trim() || research.url,
    keyword: focusKeyword?.trim() || undefined,
    excerpt: research.bodyText.slice(0, 600),
    metaDescription: "",
  };
}

export function buildMetaContextResearchMarkdown(research: MetaContextResearch): string {
  return buildMetaSeoContextBlock({
    url: research.url,
    title: research.title,
    bodyText: research.bodyText,
    focusKeyword: undefined,
  });
}
