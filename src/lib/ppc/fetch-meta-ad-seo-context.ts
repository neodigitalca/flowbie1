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

export function buildMetaSeoContextBlock(input: MetaSeoContextInput): string {
  const lines = [
    "SEO page context (DataForSEO on_page/content_parsing):",
    `URL: ${input.url.trim()}`,
  ];
  if (input.title?.trim()) {
    lines.push(`Title: ${input.title.trim()}`);
  }
  if (input.focusKeyword?.trim()) {
    lines.push(`Focus keyword: ${input.focusKeyword.trim()}`);
  }
  if (input.bodyText?.trim()) {
    lines.push(`Page content (excerpt): ${input.bodyText.trim()}`);
  }
  return lines.join("\n");
}

export async function fetchMetaAdSeoContext(
  url: string,
  options?: { focusKeyword?: string; signal?: AbortSignal },
): Promise<{ pageContext: string; title: string; bodyText: string }> {
  const trimmedUrl = url.trim();
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error("Context URL must start with http:// or https://.");
  }

  const raw = await fetchOnPageContentParsing({
    url: trimmedUrl,
    signal: options?.signal,
  });
  const title = extractPageTitleFromOnPageDfsResponse(raw);
  const bodyText = extractPlainTextFromOnPageDfsResponse(raw);

  const pageContext = buildMetaSeoContextBlock({
    url: trimmedUrl,
    title,
    bodyText: bodyText.trim(),
    focusKeyword: options?.focusKeyword,
  });

  return { pageContext, title, bodyText: bodyText.trim() };
}
