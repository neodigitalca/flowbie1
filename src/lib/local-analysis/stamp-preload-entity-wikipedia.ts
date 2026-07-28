import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { checkWikipediaPageExists, searchWikipediaPages } from "@/lib/wikipedia/mediawiki-search";

type WikiHit = { url: string; title: string };

async function resolveEntityWikipediaMediaWiki(entity: string): Promise<WikiHit | null> {
  const e = entity.trim();
  if (!e) return null;

  const exact = await checkWikipediaPageExists(e);
  if (exact.exists && exact.url && exact.title) {
    return { url: exact.url, title: exact.title };
  }

  const parts = e.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const placeCity = `${parts[0]}, ${parts[1]}`;
    const placeHit = await checkWikipediaPageExists(placeCity);
    if (placeHit.exists && placeHit.url && placeHit.title) {
      return { url: placeHit.url, title: placeHit.title };
    }
  }

  const searchQ = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : e;
  const titles = await searchWikipediaPages(searchQ, 10);
  for (const title of titles) {
    const hit = await checkWikipediaPageExists(title);
    if (hit.exists && hit.url && hit.title) {
      return { url: hit.url, title: hit.title };
    }
  }
  return null;
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
      const hit = await resolveEntityWikipediaMediaWiki(entity);
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
