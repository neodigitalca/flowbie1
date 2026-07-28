import { getMediaWikiApiUrlWithQuery } from "./mediawiki-api-url";

/** ~max chars per intro from the MediaWiki extracts API (before prompt clamp). */
export const SAP_WIKI_INTRO_EXCHARS = 1200;
/** Hard cap on intro text sent into the SAP LLM prompt per cluster (saves tokens). */
export const SAP_WIKI_PROMPT_MAX_PER_CLUSTER = 1600;

export async function fetchWikipediaIntroPlainText(
  resolvedArticleTitle: string,
  maxChars: number = SAP_WIKI_INTRO_EXCHARS
): Promise<string> {
  const t = resolvedArticleTitle.trim();
  if (!t) return "";
  const cap = Math.min(2000, Math.max(200, Math.floor(maxChars)));
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    exintro: "1",
    exchars: String(cap),
    titles: t,
    redirects: "1",
    format: "json",
    formatversion: "2",
    utf8: "1",
    origin: "*",
  });
  try {
    const response = await fetch(getMediaWikiApiUrlWithQuery(params), {
      method: "GET",
      headers: { Accept: "application/json" },
      mode: "cors",
    });
    if (!response.ok) return "";
    const data = await response.json();
    const page = data?.query?.pages?.[0];
    if (!page || page.missing) return "";
    return String(page.extract ?? "").trim();
  } catch {
    return "";
  }
}
