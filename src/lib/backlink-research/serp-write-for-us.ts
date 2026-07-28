/**
 * DataForSEO organic SERP for a single "write for us" style keyword.
 */

import type { BacklinkTile } from "@/lib/backlink-research/openrouter-backlink-tiles";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";

export type SerpOrganicRow = {
  title: string;
  url: string;
  description: string;
};

/** One search query: industry phrase + " write for us". */
export function buildWriteForUsKeyword(industry: string): string {
  return `${industry} write for us`;
}

export function extractOrganicRowsFromSerpJson(serpJson: unknown): SerpOrganicRow[] {
  const root = serpJson as {
    tasks?: Array<{
      status_code?: number;
      result?: Array<{ items?: unknown[] }>;
    }>;
  };
  const t0 = root.tasks?.[0];
  if (t0?.status_code != null && t0.status_code !== 20000) {
    return [];
  }
  const items = t0?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  const out: SerpOrganicRow[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as {
      type?: string;
      title?: string;
      description?: string;
      snippet?: string;
      url?: string;
      link?: string;
    };
    if (o.type != null && o.type !== "organic") continue;
    const url = typeof o.url === "string" ? o.url : typeof o.link === "string" ? o.link : "";
    if (!url.startsWith("http")) continue;
    const key = url.split("#")[0] ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      title: typeof o.title === "string" ? o.title : "",
      description:
        typeof o.description === "string"
          ? o.description
          : typeof o.snippet === "string"
            ? o.snippet
            : "",
      url,
    });
  }
  return out;
}

export async function fetchWriteForUsSerpOrganic(args: {
  industry: string;
  location_name: string;
  depth: number;
  signal?: AbortSignal;
}): Promise<{ keyword: string; rows: SerpOrganicRow[]; raw: unknown }> {
  const keyword = buildWriteForUsKeyword(args.industry);
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const url = `${base}/api/mcp/DataForSEO_serp_organic_live_advanced`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyword,
      location_name: args.location_name,
      language_code: "en",
      depth: args.depth,
    }),
    signal: args.signal,
  });
  const j = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new Error(j.error || `DataForSEO SERP failed (${res.status})`);
  }
  const rows = extractOrganicRowsFromSerpJson(j);
  return { keyword, rows, raw: j };
}

export function buildSerpDigestText(args: { keyword: string; rows: SerpOrganicRow[] }): string {
  const lines: string[] = [
    `Keyword: ${args.keyword}`,
    "",
    "Organic results:",
  ];
  args.rows.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title || "(no title)"}`);
    lines.push(`   URL: ${r.url}`);
    if (r.description) lines.push(`   Snippet: ${r.description}`);
    lines.push("");
  });
  return lines.join("\n");
}

function normalizeSerpUrlKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    return `${u.origin}${path}`.toLowerCase();
  } catch {
    return url.split("#")[0]?.toLowerCase() ?? url;
  }
}

/** Attach organic result titles so tiles can show a page-title line before enrichment. */
export function mergeSerpTitlesIntoBacklinkTiles(
  rows: SerpOrganicRow[],
  tiles: BacklinkTile[],
): BacklinkTile[] {
  const byExact = new Map<string, string>();
  const byNorm = new Map<string, string>();
  for (const r of rows) {
    const title = r.title?.trim();
    if (!title) continue;
    byExact.set(r.url, title);
    byNorm.set(normalizeSerpUrlKey(r.url), title);
  }
  return tiles.map((tile) => {
    if (tile.serpTitle?.trim()) return tile;
    const exact = byExact.get(tile.url);
    if (exact) return { ...tile, serpTitle: exact };
    const fromNorm = byNorm.get(normalizeSerpUrlKey(tile.url));
    if (fromNorm) return { ...tile, serpTitle: fromNorm };
    return tile;
  });
}
