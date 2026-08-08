import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { resolveEntityWikipediaMediaWiki } from "@/lib/wikipedia/resolve-entity-wikipedia-mediawiki";

type WikiHit = { url: string; title: string };

async function resolveEntityWikipediaMediaWikiLegacy(entity: string): Promise<WikiHit | null> {
  const hit = await resolveEntityWikipediaMediaWiki(entity);
  if (!hit) return null;
  return { url: hit.url, title: hit.title };
}

/**
 * One MediaWiki resolve per unique entity, then stamp `wikipedia_url` / `wikipedia_title` on all matching rows.
 */
export async function stampPreloadRowsWithUniqueEntityWikipedia(rows: CSVRow[]): Promise<CSVRow[]> {
  if (rows.length === 0) return rows;

  const byKey = new Map<string, WikiHit>();
  for (const r of rows) {
    const e = (r.entity ?? "").trim();
    const url = r.wikipedia_url?.trim();
    const title = r.wikipedia_title?.trim();
    if (e && url && title) byKey.set(e.toLowerCase(), { url, title });
  }

  const unique = [
    ...new Set(rows.map((r) => (r.entity ?? "").trim()).filter(Boolean)),
  ];
  const missing = unique.filter((e) => !byKey.has(e.toLowerCase()));

  await Promise.all(
    missing.map(async (entity) => {
      const hit = await resolveEntityWikipediaMediaWikiLegacy(entity);
      if (hit) byKey.set(entity.toLowerCase(), hit);
    }),
  );

  return rows.map((r) => {
    const e = (r.entity ?? "").trim();
    if (!e) return r;
    if (r.wikipedia_url?.trim() && r.wikipedia_title?.trim()) return r;
    const hit = byKey.get(e.toLowerCase());
    if (!hit) return r;
    return { ...r, wikipedia_url: hit.url, wikipedia_title: hit.title };
  });
}
