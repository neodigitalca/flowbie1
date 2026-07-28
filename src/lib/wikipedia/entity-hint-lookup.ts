import { loadApiKey } from "../api";
import { extractClusterWikiGeo } from "@/lib/local-analysis/cluster-wiki-candidates";
import { checkWikipediaPageExists, searchWikipediaPages } from "./mediawiki-search";
import { filterWikipediaTitlesForCommunityEntity } from "./filter-wikipedia-titles-for-community-entity-openrouter";
import {
  forcedPickFromList,
  pickTitleFromCandidates,
  proposeCanonicalArticleTitle,
  suggestBroaderSearch,
} from "./entity-hint-openrouter";
import { fetchWikipediaIntroPlainText } from "./mediawiki-intro";
import {
  isAcceptedWikiPlaceValidation,
  validateWikipediaPlacePage,
  type WikiPlaceValidationTier,
} from "./validate-wikipedia-place-page-openrouter";
import {
  filterWikiTitlesForPlaceHint,
  getSubCityEntityContext,
  isLikelyNonGeographicOrgTitle,
  isListOrBroadIndexTitle,
  isPlaceTitleForHint,
  streetNumberSearchQueries,
} from "./entity-hint-subcity";
import type { EntityHintWikiLookup, LookupEntityHintWikipediaOptions } from "./types";
import {
  orderWikipediaTitlesByGridPlaces,
  snapEntityHintToWikipediaArticleTitle,
  type GridPlaceWeaknessForWikiOrder,
} from "./extract-wikipedia-pool-titles";

const MAX_SEARCH_ROUNDS = 4;

function wikiValidationTierForHint(entityHint: string, resolvedTitle: string): WikiPlaceValidationTier {
  const geo = extractClusterWikiGeo(entityHint);
  if (!geo) return "neighbourhood";
  const lowerTitle = resolvedTitle.trim().toLowerCase();
  const cityRegion = `${geo.city}, ${geo.regionName}`.toLowerCase();
  if (
    lowerTitle === geo.city.trim().toLowerCase() ||
    lowerTitle === cityRegion ||
    lowerTitle === `${cityRegion}, canada`
  ) {
    return "city";
  }
  return "neighbourhood";
}

async function fetchIntrosForTitlesBatch(titles: string[], maxChars: number): Promise<string[]> {
  const out: string[] = [];
  const batchSize = 5;
  for (let i = 0; i < titles.length; i += batchSize) {
    const slice = titles.slice(i, i + batchSize);
    const parts = await Promise.all(slice.map((t) => fetchWikipediaIntroPlainText(t, maxChars)));
    out.push(...parts);
  }
  return out;
}

/** OpenRouter: drop non-geography titles - teams, media, dig sites; keep places. */
async function communityFilterCandidates(
  list: string[],
  apiKey: string,
  siteId: string | undefined
): Promise<string[]> {
  if (list.length === 0) return list;
  const intros = await fetchIntrosForTitlesBatch(list, 280);
  return filterWikipediaTitlesForCommunityEntity({
    apiKey: apiKey.trim(),
    siteId,
    titles: list,
    introSnippets: intros,
  });
}

async function resolveVerifiedTitle(
  title: string,
  searchedQuery: string,
  entityHint?: string,
  apiKey?: string,
  siteId?: string,
): Promise<{ kind: "closest"; title: string; url: string; searchedQuery: string } | null> {
  const ex = await checkWikipediaPageExists(title);
  if (!ex.exists || !ex.title || !ex.url) return null;

  const hint = (entityHint ?? searchedQuery).trim();
  const geo = extractClusterWikiGeo(hint);
  if (geo?.city && apiKey?.trim()) {
    const intro = await fetchWikipediaIntroPlainText(ex.title, 600);
    const validation = await validateWikipediaPlacePage({
      apiKey,
      siteId,
      entity: hint,
      candidateTitle: title,
      resolvedTitle: ex.title,
      expectedCity: geo.city,
      expectedRegion: geo.regionName,
      intro,
    });
    const tier = wikiValidationTierForHint(hint, ex.title);
    if (!isAcceptedWikiPlaceValidation(validation, tier)) return null;
  }

  return { kind: "closest", title: ex.title, url: ex.url, searchedQuery };
}

/** Last resort: OpenRouter picks closest geography from search pool, then city article from hint. */
async function closestFallbackFromSeen(
  q: string,
  seen: Set<string>,
  ctx: ReturnType<typeof getSubCityEntityContext>,
  apiKey: string,
  siteId: string | undefined,
): Promise<EntityHintWikiLookup | null> {
  const raw = [...seen].filter((t) => t.trim().length > 0);
  if (raw.length === 0) return null;

  const geographic = filterWikiTitlesForPlaceHint(raw, ctx);
  const tiers: string[][] = [
    geographic,
    raw.filter((t) => !isLikelyNonGeographicOrgTitle(t) && !isListOrBroadIndexTitle(t)),
    raw.filter((t) => !isLikelyNonGeographicOrgTitle(t)),
    raw,
  ];

  for (const tier of tiers) {
    if (tier.length === 0) continue;
    const filtered = await communityFilterCandidates(tier, apiKey, siteId);
    const pool = filtered.length > 0 ? filtered : tier;
    const forced = await forcedPickFromList(q, pool, siteId, apiKey);
    const picks = forced ? [forced, ...pool.filter((t) => t !== forced)] : pool;
    for (const title of picks.slice(0, 12)) {
      const r = await resolveVerifiedTitle(title, q, q, apiKey, siteId);
      if (r) return r;
    }
  }

  if (!ctx) {
    const parts = q.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const cityWord = parts[1]!.split(/\s+/)[0]!;
      if (cityWord) {
        const r = await resolveVerifiedTitle(cityWord, q, q, apiKey, siteId);
        if (r) return r;
      }
    }
  }
  return null;
}

/**
 * Prefer Local analysis granular-pool titles before generic MediaWiki / OpenRouter search.
 */
async function tryResolveFromPreferredPool(
  q: string,
  ctx: ReturnType<typeof getSubCityEntityContext>,
  options: LookupEntityHintWikipediaOptions | undefined
): Promise<EntityHintWikiLookup | null> {
  const prefs = options?.preferredTitles?.filter((t) => typeof t === "string" && t.trim().length > 0);
  if (!prefs || prefs.length === 0) return null;

  const gw = options.gridPlaceWeights ?? [];
  const ordered =
    gw.length > 0
      ? orderWikipediaTitlesByGridPlaces([...prefs], gw as GridPlaceWeaknessForWikiOrder[])
      : orderWikipediaTitlesByGridPlaces([...prefs], []);
  const snapped = snapEntityHintToWikipediaArticleTitle(q.trim(), ordered, 0).trim();

  /** Distinct iteration order: best snap first, then remaining pool titles. */
  const seenLower = new Set<string>();
  const candidates: string[] = [];
  for (const x of [snapped, ...ordered]) {
    const k = x.trim().toLowerCase();
    if (!k || seenLower.has(k)) continue;
    seenLower.add(k);
    candidates.push(x.trim());
  }

  const apiKey = loadApiKey()?.trim();
  for (const candidate of candidates) {
    if (!isPlaceTitleForHint(candidate, ctx)) continue;
    const r = await resolveVerifiedTitle(candidate, q, q, apiKey, options?.siteId);
    if (!r || !isPlaceTitleForHint(r.title, ctx)) continue;
    if (candidate.toLowerCase() === r.title.toLowerCase()) {
      return { kind: "exact", title: r.title, url: r.url };
    }
    return { kind: "closest", title: r.title, url: r.url, searchedQuery: q };
  }
  return null;
}

/**
 * Resolve English Wikipedia article for a free-text entity using OpenRouter (research model) + MediaWiki search/exists.
 * MediaWiki has no API key; OpenRouter is required - no degraded search-only path.
 */
export async function lookupEntityHintWikipedia(
  entityHint: string,
  options?: LookupEntityHintWikipediaOptions
): Promise<EntityHintWikiLookup> {
  const q = entityHint.trim();
  if (!q) return { kind: "empty" };

  const apiKey = loadApiKey()?.trim();
  if (!apiKey) {
    return { kind: "none", searchedQuery: q };
  }

  const siteId = options?.siteId;
  const ctx = getSubCityEntityContext(q);

  const poolMatch = await tryResolveFromPreferredPool(q, ctx, options);
  if (poolMatch) return poolMatch;

  const directVerified = await resolveVerifiedTitle(q, q, q, apiKey, siteId);
  if (directVerified && isPlaceTitleForHint(directVerified.title, ctx)) {
    return { kind: "exact", title: directVerified.title, url: directVerified.url };
  }

  if (ctx) {
    const placeHeadHit = await resolveVerifiedTitle(ctx.placeHead, q, q, apiKey, siteId);
    if (placeHeadHit && isPlaceTitleForHint(placeHeadHit.title, ctx)) {
      return placeHeadHit;
    }
    const placeHeadSearch = await searchWikipediaPages(ctx.placeHead, 12);
    for (const title of placeHeadSearch) {
      if (!isPlaceTitleForHint(title, ctx)) continue;
      const r = await resolveVerifiedTitle(title, ctx.placeHead, q, apiKey, siteId);
      if (r) return r;
    }
  }

  const seen = new Set<string>();
  let lastQuery = q;

  const mergeBatch = (titles: string[]) => {
    for (const t of titles) seen.add(t);
  };

  function candidatesForModel(seenTitles: string[]): string[] {
    return filterWikiTitlesForPlaceHint([...seenTitles], ctx);
  }

  async function expandSearchIfNoGoodCandidates(): Promise<void> {
    if (!ctx) return;
    if (filterWikiTitlesForPlaceHint([...seen], ctx).length > 0) return;
    mergeBatch(await searchWikipediaPages(`${ctx.placeHead} ${ctx.cityWord}`, 25));
    mergeBatch(await searchWikipediaPages(`${ctx.placeHead}, ${ctx.cityWord}`, 25));
  }

  mergeBatch(await searchWikipediaPages(q, 25));
  const wikiAug = options?.wikipediaSearchAugment?.trim();
  if (wikiAug) {
    mergeBatch(await searchWikipediaPages(`${q} ${wikiAug}`, 25));
  }
  if (ctx) {
    mergeBatch(await searchWikipediaPages(`${ctx.placeHead} ${ctx.cityWord}`, 25));
    if (wikiAug) {
      mergeBatch(await searchWikipediaPages(`${ctx.placeHead} ${ctx.cityWord} ${wikiAug}`, 25));
    }
    for (const sq of streetNumberSearchQueries(ctx.placeHead, ctx.cityWord)) {
      mergeBatch(await searchWikipediaPages(sq, 25));
    }
  }
  await expandSearchIfNoGoodCandidates();

  for (let round = 0; round < MAX_SEARCH_ROUNDS; round++) {
    if (round > 0) {
      mergeBatch(await searchWikipediaPages(lastQuery, 25));
    }
    await expandSearchIfNoGoodCandidates();

    let list = candidatesForModel([...seen]);
    list = await communityFilterCandidates(list, apiKey, siteId);
    if (list.length === 0) {
      const sug = await suggestBroaderSearch(q, siteId, apiKey);
      if (sug.title && isPlaceTitleForHint(sug.title, ctx)) {
        const r = await resolveVerifiedTitle(sug.title, lastQuery, q, apiKey, siteId);
        if (r) return r;
      }
      if (sug.searchQuery) {
        lastQuery = sug.searchQuery;
        continue;
      }
      break;
    }

    const picked = await pickTitleFromCandidates(q, list, siteId, apiKey);
    if (picked && isPlaceTitleForHint(picked, ctx)) {
      const r = await resolveVerifiedTitle(picked, lastQuery, q, apiKey, siteId);
      if (r) return r;
    }

    if (round < MAX_SEARCH_ROUNDS - 1) {
      const sug = await suggestBroaderSearch(q, siteId, apiKey);
      if (sug.searchQuery && sug.searchQuery.trim() !== lastQuery.trim()) {
        lastQuery = sug.searchQuery.trim();
        continue;
      }
    }
    break;
  }

  let list = candidatesForModel([...seen]);
  list = await communityFilterCandidates(list, apiKey, siteId);
  if (list.length > 0) {
    const forced = await forcedPickFromList(q, list, siteId, apiKey);
    const use =
      forced && isPlaceTitleForHint(forced, ctx)
        ? forced
        : list.find((t) => isPlaceTitleForHint(t, ctx));
    if (use) {
      const r = await resolveVerifiedTitle(use, lastQuery, q, apiKey, siteId);
      if (r) return r;
    }
  }

  const proposed = await proposeCanonicalArticleTitle(q, siteId, apiKey);
  if (proposed && isPlaceTitleForHint(proposed, ctx)) {
    const r = await resolveVerifiedTitle(proposed, q, q, apiKey, siteId);
    if (r) return r;
    mergeBatch(await searchWikipediaPages(proposed, 8));
    let merged = candidatesForModel([...seen]);
    merged = await communityFilterCandidates(merged, apiKey, siteId);
    const pickMerged = merged.find((t) => isPlaceTitleForHint(t, ctx));
    if (pickMerged) {
      const r2 = await resolveVerifiedTitle(pickMerged, proposed, q, apiKey, siteId);
      if (r2) return r2;
    }
  }

  const fallback = await closestFallbackFromSeen(q, seen, ctx, apiKey, siteId);
  if (fallback) return fallback;

  return { kind: "none", searchedQuery: q };
}
