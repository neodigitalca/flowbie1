import { fetchOnPageContentParsing } from "@/lib/backlink-research/fetch-on-page-content-parsing";
import {
  extractPageTitleFromOnPageDfsResponse,
  extractPlainTextFromOnPageDfsResponse,
} from "@/lib/backlink-research/on-page-dfs-extract-text";

export type MetaSeoContextInput = {
  url: string;
  title?: string;
  bodyText?: string;
  focusKeyword?: string;
};

function seoText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildMetaSeoContextBlock(input: MetaSeoContextInput): string {
  const lines = [
    "SEO page context (DataForSEO on_page/content_parsing):",
    `URL: ${input.url}`,
  ];
  const title = seoText(input.title);
  const focusKeyword = seoText(input.focusKeyword);
  const bodyText = seoText(input.bodyText);
  if (title.length > 0) {
    lines.push(`Title: ${title}`);
  }
  if (focusKeyword.length > 0) {
    lines.push(`Focus keyword: ${focusKeyword}`);
  }
  if (bodyText.length > 0) {
    lines.push(`Page content (excerpt): ${bodyText}`);
  }
  return lines.join("\n");
}

export async function fetchMetaAdSeoContext(
  url: string,
  options?: { focusKeyword?: string; signal?: AbortSignal },
): Promise<{ pageContext: string; title: string; bodyText: string }> {
  if (typeof url !== "string") {
    throw new Error("Context URL must be a string.");
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Context URL must start with http:// or https://.");
  }

  const raw = await fetchOnPageContentParsing({
    url,
    signal: options?.signal,
  });
  const title = extractPageTitleFromOnPageDfsResponse(raw);
  const bodyText = extractPlainTextFromOnPageDfsResponse(raw);

  const pageContext = buildMetaSeoContextBlock({
    url,
    title,
    bodyText,
    focusKeyword: options?.focusKeyword,
  });

  return { pageContext, title, bodyText };
}
