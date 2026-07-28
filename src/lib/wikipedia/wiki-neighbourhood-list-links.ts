/**
 * Harvest article titles linked from Wikipedia "List of neighbourhoods in …" pages (generic; no gazetteers).
 */
import { getMediaWikiApiUrlWithQuery } from "./mediawiki-api-url";
import { checkWikipediaPageExists } from "./mediawiki-search";

const MAX_TITLE_LEN = 120;
const NS_MAIN = 0;

type QueryLinksBatch = {
  batchcomplete?: unknown;
  query?: {
    pages?: Array<{
      title?: string;
      missing?: boolean;
      links?: Array<{ title?: string; ns?: number }>;
    }>;
  };
  continue?: Record<string, string>;
};

/**
 * Outgoing main-namespace links from a single page via query&prop=links (enwiki proxy).
 */
export async function fetchMainNamespaceLinksFromPageTitle(
  pageTitle: string,
  maxLinks: number = 400
): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  let plcontinue: string | undefined;
  const canonicalTitle = pageTitle.trim();

  for (let safety = 0; safety < 40; safety++) {
    if (out.length >= maxLinks) break;

    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      utf8: "1",
      origin: "*",
      redirects: "1",
      titles: canonicalTitle,
      prop: "links",
      plnamespace: String(NS_MAIN),
      pllimit: "max",
    });
    if (plcontinue) params.set("plcontinue", plcontinue);

    let data: QueryLinksBatch;
    try {
      const url = getMediaWikiApiUrlWithQuery(params);
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) break;
      data = (await res.json()) as QueryLinksBatch;
    } catch {
      break;
    }

    const pages = data.query?.pages ?? [];
    const page = pages[0];
    if (!page || page.missing) break;
    if (!page.links?.length) break;

    for (const L of page.links) {
      const t = typeof L.title === "string" ? L.title.trim() : "";
      const ns = L.ns;
      if (ns != null && ns !== NS_MAIN) continue;
      if (!t || t.length > MAX_TITLE_LEN || seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      out.push(t);
      if (out.length >= maxLinks) break;
    }

    const cont = data.continue;
    plcontinue = cont?.plcontinue;
    if (!plcontinue || out.length >= maxLinks) break;
  }

  return out;
}

/**
 * Titles from "List of neighbourhoods in {city}" / "List of neighborhoods in {city}" if the page exists.
 */
export async function collectNeighbourhoodListPageLinkTitles(cityDisplay: string): Promise<string[]> {
  const city = cityDisplay.trim();
  if (city.length < 2) return [];
  const variants = [`List of neighbourhoods in ${city}`, `List of neighborhoods in ${city}`];
  for (const title of variants) {
    const ex = await checkWikipediaPageExists(title);
    if (!ex.exists || !ex.title) continue;
    return fetchMainNamespaceLinksFromPageTitle(ex.title, 400);
  }
  return [];
}
