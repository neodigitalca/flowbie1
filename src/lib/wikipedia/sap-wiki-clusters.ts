import pLimit from "p-limit";
import { lookupEntityHintWikipedia } from "./entity-hint-lookup";
import { checkWikipediaPageExists } from "./mediawiki-search";
import {
  fetchWikipediaIntroPlainText,
  SAP_WIKI_PROMPT_MAX_PER_CLUSTER,
} from "./mediawiki-intro";
import type { LookupEntityHintWikipediaOptions, SapEntityWikiCluster } from "./types";

export const SAP_WIKI_CLUSTER_CONCURRENCY = 10;

export type FetchWikipediaClustersOptions = LookupEntityHintWikipediaOptions & {
  onWikiProgress?: (done: number, total: number) => void;
};

function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

function preferredTitleForHint(hint: string, preferredTitles?: string[]): string | null {
  if (!preferredTitles?.length) return null;
  const hk = titleKey(hint);
  for (const t of preferredTitles) {
    const trimmed = t.trim();
    if (trimmed && titleKey(trimmed) === hk) return trimmed;
  }
  return null;
}

async function introForTitle(title: string): Promise<string> {
  let extract = (await fetchWikipediaIntroPlainText(title)).replace(/\s+/g, " ").trim();
  if (extract.length > SAP_WIKI_PROMPT_MAX_PER_CLUSTER) {
    extract = extract.slice(0, SAP_WIKI_PROMPT_MAX_PER_CLUSTER).trim() + "…";
  }
  return extract;
}

async function resolveClusterForHint(
  hint: string,
  options?: LookupEntityHintWikipediaOptions,
): Promise<SapEntityWikiCluster | null> {
  const poolTitle = preferredTitleForHint(hint, options?.preferredTitles);
  if (poolTitle) {
    const ex = await checkWikipediaPageExists(poolTitle);
    if (!ex.exists || !ex.title || !ex.url) return null;
    return {
      entityHint: hint,
      title: ex.title,
      url: ex.url,
      extract: await introForTitle(ex.title),
    };
  }

  const lookup = await lookupEntityHintWikipedia(hint, options);
  if (lookup.kind === "empty" || lookup.kind === "none") return null;
  return {
    entityHint: hint,
    title: lookup.title,
    url: lookup.url,
    extract: await introForTitle(lookup.title),
  };
}

/**
 * Resolve Wikipedia once per **unique** entity hint string and fetch the article intro only.
 */
export async function fetchWikipediaClustersForSapEntityHints(
  entityHints: string[],
  options?: FetchWikipediaClustersOptions,
): Promise<SapEntityWikiCluster[]> {
  const unique = [...new Set(entityHints.map((h) => h.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  let done = 0;
  const total = unique.length;
  const limit = pLimit(SAP_WIKI_CLUSTER_CONCURRENCY);
  const clusters = await Promise.all(
    unique.map((hint) =>
      limit(async () => {
        const cluster = await resolveClusterForHint(hint, options);
        done += 1;
        options?.onWikiProgress?.(done, total);
        return cluster;
      }),
    ),
  );
  return clusters.filter((c): c is SapEntityWikiCluster => c !== null);
}
