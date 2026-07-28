import { isCityUmbrellaTitle, isListOrBroadIndexTitle } from "./entity-hint-subcity";
import { filterWikipediaTitlesForCommunityEntity } from "./filter-wikipedia-titles-for-community-entity-openrouter";
import { filterNonCommunityWikipediaTitles } from "./wikipedia-title-guards";
import { fetchWikipediaIntroPlainText } from "./mediawiki-intro";
import { searchWikipediaPages } from "./mediawiki-search";
import { collectNeighbourhoodListPageLinkTitles } from "./wiki-neighbourhood-list-links";
import { filterOrderedTitlesToExistingCanonical } from "./wiki-validation";
import { getPagesInCategory, searchWikipediaCategories } from "./wiki-categories";
import { getLinksFromWikipediaPage } from "./wiki-links-lists";
import { wikipediaArticleUrl } from "./wiki-urls";

const MAX_TITLES = 18;
const INTRO_CHARS = 420;
const SEARCH_PER_QUERY = 40;
const MAX_CATEGORIES_TO_EXPAND = 8;
const MEMBERS_PER_CATEGORY = 55;
/** Outbound `links` scrape from canonical pool titles (distinct child articles for SAP diversification). */
const MAX_PARENT_PAGES_FOR_OUTGOING_LINKS = 6;
const OUTGOING_LINKS_FETCH_PER_PARENT = 55;
const MAX_EXTRA_TITLES_FROM_OUTGOING_LINKS = 32;
/** Hard cap before intro fetch / AI filter (matches pre-enrich category+list+search budget). */
const MAX_TITLES_BEFORE_INTROS = MAX_TITLES * 2;

export type WikiPlaceGrepProgressEvent =
  | { phase: "start"; metroLabel: string }
  | { phase: "stage"; message: string }
  | { phase: "category" | "listPage" | "search" | "outgoing"; title: string }
  | { phase: "picked"; title: string };

export type WikipediaGranularEntityPoolForSuggestOptions = {
  city: string;
  region: string;
  /** Grid CSV place hints — when set, Wikipedia is searched from these strings only. */
  gridPlaceHints?: string[];
  /** When set (e.g. from grid CSV hints), category/search use this city so a distant core-metro name does not dominate. */
  dominantGridCity?: string;
  siteId?: string;
  /** When set, titles are filtered with OpenRouter for community-first local SEO entities. */
  apiKey?: string;
  /** Real-time UX: category/list/search pulls and final pool picks (no PII — Wikipedia titles only). */
  onWikiPlaceGrepProgress?: (e: WikiPlaceGrepProgressEvent) => void;
};

export type WikipediaGranularEntityPoolResult = {
  markdown: string;
  /** Canonical enwiki article titles (same order as pool markdown `###` blocks). */
  titles: string[];
  /** Parallel Wikipedia URLs for `titles`. */
  urls: string[];
  /** Lowercase titles that came from Category: members API. */
  categoryMemberTitles: ReadonlySet<string>;
  /** Lowercase titles discovered via links on "List of neighbourhoods in …". */
  listPageLinkTitles: ReadonlySet<string>;
  /** Lowercase titles first seen as outbound links from other pool articles (child geography). */
  outgoingArticleLinkTitles: ReadonlySet<string>;
};

async function mapInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

/** Empty structured result helper. */
function emptyGranularPool(): WikipediaGranularEntityPoolResult {
  return {
    markdown: "",
    titles: [],
    urls: [],
    categoryMemberTitles: new Set(),
    listPageLinkTitles: new Set(),
    outgoingArticleLinkTitles: new Set(),
  };
}

/**
 * Wikipedia **category** namespace search → `categorymembers` for article titles.
 * Includes neighbourhoods **and** landmarks / parks / structures where enwiki categorizes them.
 */
async function collectArticleTitlesFromWikipediaCategories(
  city: string,
  emitProgress: ((e: WikiPlaceGrepProgressEvent) => void) | undefined
): Promise<string[]> {
  emitProgress?.({ phase: "stage", message: "Searching Wikipedia categories (neighbourhoods, districts, parks…)…" });
  const queries = [
    `Neighbourhoods in ${city}`,
    `Neighborhoods in ${city}`,
    `Districts in ${city}`,
    `Districts of ${city}`,
    `Suburbs of ${city}`,
    `Industrial areas in ${city}`,
    `Communities in ${city}`,
    `Landmarks in ${city}`,
    `Landmarks of ${city}`,
    `Buildings and structures in ${city}`,
    `Parks in ${city}`,
    `Sports venues in ${city}`,
    `Shopping malls in ${city}`,
  ];
  const cats = await searchWikipediaCategories(queries, 15);
  const seenCat = new Set<string>();
  const uniqueCats = cats.filter((c) => {
    const k = c.toLowerCase();
    if (seenCat.has(k)) return false;
    seenCat.add(k);
    return true;
  });

  const out: string[] = [];
  const seen = new Set<string>();
  for (const cat of uniqueCats.slice(0, MAX_CATEGORIES_TO_EXPAND)) {
    const pages = await getPagesInCategory(cat, { limit: MEMBERS_PER_CATEGORY, pageOnly: true });
    for (const p of pages) {
      const t = p.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      if (isCityUmbrellaTitle(t, city)) continue;
      if (isListOrBroadIndexTitle(t)) continue;
      if (k === city.toLowerCase()) continue;
      seen.add(k);
      out.push(t);
      emitProgress?.({ phase: "category", title: t });
    }
  }
  return out;
}

/**
 * Add geography linked **from** each canonical pool article (MediaWiki outbound links → resolve).
 * Gives distinct child/community articles for rotating entityHint across SAP keyword rows (vs repeating one place).
 */
async function enrichCanonicalPoolTitlesWithOutgoingLinks(
  city: string,
  region: string,
  primaryCanonTitles: string[],
  emitProgress: ((e: WikiPlaceGrepProgressEvent) => void) | undefined
): Promise<{ titles: string[]; outgoingArticleLinkTitles: Set<string> }> {
  const emptyOut = new Set<string>();
  if (primaryCanonTitles.length === 0) return { titles: primaryCanonTitles, outgoingArticleLinkTitles: emptyOut };

  emitProgress?.({
    phase: "stage",
    message: "Grepping outbound links on pool articles (child places, districts, landmarks…)…",
  });

  const primaryKeys = new Set(primaryCanonTitles.map((t) => t.toLowerCase()));
  const queuedRaw: string[] = [];
  const queuedSeen = new Set<string>();

  for (const parent of primaryCanonTitles.slice(0, MAX_PARENT_PAGES_FOR_OUTGOING_LINKS)) {
    const links = await getLinksFromWikipediaPage(parent, {
      limit: OUTGOING_LINKS_FETCH_PER_PARENT,
      filterNamespaces: true,
    });
    for (const raw of links) {
      const t = raw.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (primaryKeys.has(k) || queuedSeen.has(k)) continue;
      if (isCityUmbrellaTitle(t, city)) continue;
      if (isListOrBroadIndexTitle(t)) continue;
      if (k === city.toLowerCase()) continue;
      if (region && k === region.toLowerCase()) continue;
      queuedSeen.add(k);
      queuedRaw.push(t);
      emitProgress?.({ phase: "outgoing", title: t });
      if (queuedRaw.length >= MAX_EXTRA_TITLES_FROM_OUTGOING_LINKS) break;
    }
    if (queuedRaw.length >= MAX_EXTRA_TITLES_FROM_OUTGOING_LINKS) break;
  }

  if (queuedRaw.length === 0) {
    return { titles: primaryCanonTitles, outgoingArticleLinkTitles: emptyOut };
  }

  const queuedCanon = await filterOrderedTitlesToExistingCanonical(queuedRaw);
  const outgoingKeys = new Set(queuedCanon.map((t) => t.toLowerCase()));
  const merged = [...primaryCanonTitles, ...queuedRaw].slice(0, MAX_TITLES_BEFORE_INTROS);
  const resolved = await filterOrderedTitlesToExistingCanonical(merged);
  if (resolved.length === 0) {
    return { titles: primaryCanonTitles, outgoingArticleLinkTitles: emptyOut };
  }

  const outgoingArticleLinkTitles = new Set(
    resolved.filter((t) => outgoingKeys.has(t.toLowerCase())).map((t) => t.toLowerCase()),
  );

  return { titles: resolved, outgoingArticleLinkTitles };
}

/** Search Wikipedia for each grid CSV place hint (grid is the geography source). */
async function collectTitlesFromGridPlaceHints(
  hints: string[],
  emitProgress: ((e: WikiPlaceGrepProgressEvent) => void) | undefined,
): Promise<string[]> {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hints) {
    const q = raw.trim();
    if (!q) continue;
    emitProgress?.({ phase: "stage", message: `Searching Wikipedia for «${q}»…` });
    const batch = await searchWikipediaPages(q, SEARCH_PER_QUERY);
    for (const t of batch) {
      const key = t.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      if (isListOrBroadIndexTitle(t)) continue;
      seen.add(key);
      out.push(t.trim());
      emitProgress?.({ phase: "search", title: t.trim() });
      if (out.length >= MAX_TITLES * 2) break;
    }
    if (out.length >= MAX_TITLES * 2) break;
  }
  return out;
}

async function finalizeGranularPoolTitles(
  opts: WikipediaGranularEntityPoolForSuggestOptions,
  city: string,
  region: string,
  titlesIn: string[],
  categoryKey: ReadonlySet<string>,
  listPageKey: ReadonlySet<string>,
  emitProgress: ((e: WikiPlaceGrepProgressEvent) => void) | undefined,
): Promise<WikipediaGranularEntityPoolResult> {
  let titles = titlesIn.slice(0, MAX_TITLES * 2);
  if (titles.length === 0) return emptyGranularPool();

  emitProgress?.({
    phase: "stage",
    message: `Resolving ${titles.length} title(s) to live Wikipedia articles…`,
  });

  titles = await filterOrderedTitlesToExistingCanonical(titles);
  if (titles.length === 0) return emptyGranularPool();

  titles = filterNonCommunityWikipediaTitles(titles);
  if (titles.length === 0) return emptyGranularPool();

  const enriched = await enrichCanonicalPoolTitlesWithOutgoingLinks(city, region, titles, emitProgress);
  titles = enriched.titles;
  const outgoingArticleLinkTitles = enriched.outgoingArticleLinkTitles;
  if (titles.length === 0) return emptyGranularPool();

  let intros = await mapInBatches(titles, 5, (title) => fetchWikipediaIntroPlainText(title, INTRO_CHARS));
  const titlesDeterministic = titles;
  const introsDeterministic = intros;
  const apiKeyTrim = (opts.apiKey ?? "").trim();
  if (apiKeyTrim) {
    emitProgress?.({
      phase: "stage",
      message: "Filtering for geographic place pages (AI)…",
    });
    const filtered = await filterWikipediaTitlesForCommunityEntity({
      apiKey: apiKeyTrim,
      siteId: opts.siteId,
      titles: titlesDeterministic,
      introSnippets: introsDeterministic,
    });
    const byLower = new Map(titlesDeterministic.map((t, i) => [t.toLowerCase(), i] as const));
    if (filtered.length > 0) {
      const guarded = filterNonCommunityWikipediaTitles(filtered);
      titles = guarded;
      intros = guarded.map((t) => {
        const idx = byLower.get(t.toLowerCase());
        return idx !== undefined ? introsDeterministic[idx] ?? "" : "";
      });
    } else {
      return emptyGranularPool();
    }
  }

  if (titles.length === 0) return emptyGranularPool();

  for (const title of titles) {
    emitProgress?.({ phase: "picked", title });
  }

  const urls = titles.map((t) => wikipediaArticleUrl(t));
  const gridDriven = (opts.gridPlaceHints?.length ?? 0) > 0;
  const lines: string[] = [
    gridDriven
      ? `**Grid CSV geography:** Wikipedia titles below were resolved from your uploaded grid place hints. Pick \`entityHint\` from the \`###\` lines only.`
      : `Metro context (for reading only): **${city}**${region ? `, ${region}` : ""}.`,
    `**Allowed entityHint values (mandatory):** Each \`entityHint\` must match one \`###\` article title below (same spelling). **Do not** invent place names or paste raw grid addresses as entityHint.`,
    "",
  ];

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]!;
    const intro = (intros[i] ?? "").replace(/\s+/g, " ").trim();
    const excerpt = intro.length > 0 ? intro : "(no intro extract)";
    const lowerTitle = title.toLowerCase();
    const source = gridDriven
      ? "grid place hint search"
      : outgoingArticleLinkTitles.has(lowerTitle)
        ? "outgoing links from pool articles (child places)"
        : categoryKey.has(lowerTitle)
          ? "category members (Category:… API)"
          : listPageKey.has(lowerTitle)
            ? "list of neighbourhoods page (outgoing article links)"
            : "article search";
    lines.push(`### ${title}`);
    lines.push(`- Source: **${source}**`);
    lines.push(`- URL: ${wikipediaArticleUrl(title)}`);
    lines.push(`- Intro: ${excerpt}`);
    lines.push("");
  }

  const markdown = lines.join("\n").trim();
  return {
    markdown,
    titles,
    urls,
    categoryMemberTitles: categoryKey,
    listPageLinkTitles: listPageKey,
    outgoingArticleLinkTitles,
  };
}

/**
 * Grid place hints (primary) or metro category search (legacy) + intro extracts.
 */
export async function buildWikipediaGranularEntityPool(
  opts: WikipediaGranularEntityPoolForSuggestOptions
): Promise<WikipediaGranularEntityPoolResult> {
  const city = (opts.dominantGridCity?.trim() || opts.city).trim();
  const region = opts.region.trim();
  const emitProgress = opts.onWikiPlaceGrepProgress;
  const gridHints = (opts.gridPlaceHints ?? []).map((h) => h.trim()).filter((h) => h.length > 0);

  if (gridHints.length > 0) {
    const metroLabel = gridHints[0]!;
    emitProgress?.({ phase: "start", metroLabel });
    emitProgress?.({ phase: "stage", message: "Grepping Wikipedia from grid place hints…" });
    const fromGrid = await collectTitlesFromGridPlaceHints(gridHints, emitProgress);
    return finalizeGranularPoolTitles(
      opts,
      city || metroLabel.split(",")[0]?.trim() || metroLabel,
      region,
      fromGrid,
      new Set(),
      new Set(),
      emitProgress,
    );
  }

  if (!city) return emptyGranularPool();

  emitProgress?.({
    phase: "start",
    metroLabel: region ? `${city}, ${region}` : city,
  });

  const fromCategory = await collectArticleTitlesFromWikipediaCategories(city, emitProgress);

  emitProgress?.({
    phase: "stage",
    message: `Grepping «List of neighbourhoods in ${city}» (links)…`,
  });

  const fromListRaw = await collectNeighbourhoodListPageLinkTitles(city);
  const fromListPage: string[] = [];
  const listSeen = new Set<string>(fromCategory.map((t) => t.toLowerCase()));
  for (const t of fromListRaw) {
    const key = t.trim().toLowerCase();
    if (!key || listSeen.has(key)) continue;
    if (isCityUmbrellaTitle(t, city)) continue;
    if (isListOrBroadIndexTitle(t)) continue;
    if (key === city.toLowerCase()) continue;
    listSeen.add(key);
    fromListPage.push(t.trim());
    emitProgress?.({ phase: "listPage", title: t.trim() });
  }

  emitProgress?.({ phase: "stage", message: "Searching Wikipedia titles (district, suburb, corridor, landmarks…)…" });

  const queries: string[] = [
    `${city} neighbourhood`,
    `${city} neighborhood`,
    `${city} district`,
    `${city} industrial`,
    `${city} suburbs`,
    `${city} landmark`,
    `${city} park`,
    `${city} building`,
    `${city} arena`,
    `${city} shopping`,
    `${city} sports venue`,
    `List of neighbourhoods in ${city}`,
    `List of neighborhoods in ${city}`,
    `List of areas of ${city}`,
  ];
  if (region) {
    queries.push(`${city} ${region}`);
  }

  const seen = new Set<string>([...fromCategory, ...fromListPage].map((t) => t.toLowerCase()));
  const fromSearch: string[] = [];
  for (const q of queries) {
    const batch = await searchWikipediaPages(q, SEARCH_PER_QUERY);
    for (const t of batch) {
      const key = t.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      if (region && key === region.toLowerCase()) continue;
      if (isCityUmbrellaTitle(t, city)) continue;
      if (isListOrBroadIndexTitle(t)) continue;
      seen.add(key);
      fromSearch.push(t.trim());
      emitProgress?.({ phase: "search", title: t.trim() });
      if (fromCategory.length + fromListPage.length + fromSearch.length >= MAX_TITLES * 2) break;
    }
    if (fromCategory.length + fromListPage.length + fromSearch.length >= MAX_TITLES * 2) break;
  }

  const titles = [...fromCategory, ...fromListPage, ...fromSearch].slice(0, MAX_TITLES * 2);
  const categoryKey = new Set(fromCategory.map((t) => t.toLowerCase()));
  const listPageKey = new Set(fromListPage.map((t) => t.toLowerCase()));
  return finalizeGranularPoolTitles(opts, city, region, titles, categoryKey, listPageKey, emitProgress);
}

/** @deprecated Prefer `buildWikipediaGranularEntityPool` — returns markdown only for backward compatibility. */
export async function buildWikipediaGranularEntityPoolMarkdown(
  opts: WikipediaGranularEntityPoolForSuggestOptions
): Promise<string> {
  const { markdown } = await buildWikipediaGranularEntityPool(opts);
  return markdown;
}
