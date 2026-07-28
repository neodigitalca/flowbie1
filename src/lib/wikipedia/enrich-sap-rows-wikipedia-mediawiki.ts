import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { checkWikipediaPageExists, searchWikipediaPages } from "./mediawiki-search";

export type EnrichSapRowsWikipediaMediaWikiOnlyOptions = {
  wikipediaSearchAugment?: string;
};

/**
 * English Wikipedia URL/title per row using MediaWiki API only (no OpenRouter).
 * On missing page or error, the row is unchanged.
 */
export async function enrichSapRowsWithWikipediaMediaWikiOnly(
  rows: CSVRow[],
  options?: EnrichSapRowsWikipediaMediaWikiOnlyOptions,
): Promise<CSVRow[]> {
  const aug = options?.wikipediaSearchAugment?.trim();
  return Promise.all(
    rows.map(async (r) => {
      const e = (r.entity ?? "").trim();
      if (!e) return r;
      try {
        if (aug) {
          const candidates = await searchWikipediaPages(`${e} ${aug}`, 15);
          for (const title of candidates) {
            const ex = await checkWikipediaPageExists(title);
            if (ex.exists && ex.title && ex.url) {
              return { ...r, wikipedia_url: ex.url, wikipedia_title: ex.title };
            }
          }
        }
        const ex = await checkWikipediaPageExists(e);
        if (!ex.exists || !ex.title || !ex.url) return r;
        return { ...r, wikipedia_url: ex.url, wikipedia_title: ex.title };
      } catch {
        return r;
      }
    }),
  );
}
