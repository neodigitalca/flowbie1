import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { lookupEntityHintWikipedia } from "./entity-hint-lookup";
import type { LookupEntityHintWikipediaOptions } from "./types";

/** Every SAP row with an entity must have table-linked Wikipedia before export or bulk run. */
export function assertSapRowsHaveLinkedWikipedia(rows: CSVRow[]): void {
  const missing: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const entity = (r.entity ?? "").trim();
    if (!entity) continue;
    if (!r.wikipedia_url?.trim() || !r.wikipedia_title?.trim()) {
      missing.push(`Row ${i + 1}: ${entity}`);
    }
  }
  if (missing.length > 0) {
    const preview = missing.slice(0, 8).join("\n");
    const more = missing.length > 8 ? `\n…and ${missing.length - 8} more` : "";
    throw new Error(
      `Every entity row requires a linked Wikipedia article in the table. Missing for:\n${preview}${more}`,
    );
  }
}

/**
 * Reduces simultaneous Wikipedia / OpenRouter / MediaWiki load when generating many SAP rows at once.
 */
const DEFAULT_ENRICH_BATCH_SIZE = 12;

export async function enrichSapRowsWithWikipediaLookupsInBatches(
  rows: CSVRow[],
  options?: LookupEntityHintWikipediaOptions,
  batchSize: number = DEFAULT_ENRICH_BATCH_SIZE,
): Promise<CSVRow[]> {
  const size = Number.isFinite(batchSize)
    ? Math.min(48, Math.max(1, Math.floor(batchSize)))
    : DEFAULT_ENRICH_BATCH_SIZE;
  const out: CSVRow[] = [];
  for (let start = 0; start < rows.length; start += size) {
    const slice = rows.slice(start, start + size);
    out.push(...(await enrichSapRowsWithWikipediaLookups(slice, options)));
  }
  return out;
}

/**
 * Resolve English Wikipedia URL/title per SAP row `entity` via one OpenRouter-backed lookup.
 */
export async function enrichSapRowsWithWikipediaLookups(
  rows: CSVRow[],
  options?: LookupEntityHintWikipediaOptions,
): Promise<CSVRow[]> {
  return Promise.all(
    rows.map(async (r) => {
      const e = (r.entity ?? "").trim();
      if (!e) return r;

      const lookup = await lookupEntityHintWikipedia(e, options).catch(
        () => ({ kind: "none" as const, searchedQuery: e }),
      );
      if (lookup.kind === "exact" || lookup.kind === "closest") {
        return {
          ...r,
          wikipedia_url: lookup.url,
          wikipedia_title: lookup.title,
        };
      }
      return r;
    }),
  );
}
