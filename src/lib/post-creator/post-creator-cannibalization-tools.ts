import { decodeInventoryTitleText, inventoryFieldString } from "@/lib/bulk/inventory-json-slim";
import {
  jaccardSimilarity,
  normalizeDedupeKey,
  significantTokens,
} from "@/lib/vertical-benchmark/vertical-benchmark-bulk-dedupe";

export type PostCreatorInventoryRow = {
  url: string;
  keyword: string;
  title: string;
  slug: string;
};

export type PostCreatorInventoryCatalog = {
  rows: PostCreatorInventoryRow[];
  urlKeys: Set<string>;
  slugKeys: Set<string>;
};

function pathnameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").toLowerCase() || "/";
  } catch {
    const trimmed = url.trim().toLowerCase();
    return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`;
  }
}

function slugFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export function deriveSlugFromText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildPostCreatorInventoryCatalog(
  urls: readonly string[],
  richRows?: Array<{ url?: string; fields?: { keyword?: string; title?: string } }>,
): PostCreatorInventoryCatalog {
  const byUrl = new Map<string, PostCreatorInventoryRow>();
  for (const row of richRows ?? []) {
    const url = inventoryFieldString(row.url);
    if (!url) continue;
    const key = url.toLowerCase();
    const pathname = pathnameFromUrl(url);
    byUrl.set(key, {
      url,
      keyword: inventoryFieldString(row.fields?.keyword),
      title: decodeInventoryTitleText(row.fields?.title ?? ""),
      slug: slugFromPathname(pathname),
    });
  }

  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (byUrl.has(key)) continue;
    const pathname = pathnameFromUrl(trimmed);
    const slug = slugFromPathname(pathname);
    byUrl.set(key, {
      url: trimmed,
      keyword: slug.replace(/-/g, " "),
      title: slug.replace(/-/g, " "),
      slug,
    });
  }

  const rows = Array.from(byUrl.values());
  return {
    rows,
    urlKeys: new Set(rows.map((r) => r.url.toLowerCase())),
    slugKeys: new Set(rows.map((r) => r.slug).filter(Boolean)),
  };
}

export function lookupInventoryByKeyword(
  catalog: PostCreatorInventoryCatalog,
  query: string,
  limit = 8,
): PostCreatorInventoryRow[] {
  const q = query.trim();
  if (!q) return [];
  const qKey = normalizeDedupeKey(q);
  const qTokens = significantTokens(q);
  const scored = catalog.rows
    .map((row) => {
      const fields = [row.keyword, row.title, row.slug.replace(/-/g, " ")].filter(Boolean);
      let score = 0;
      for (const field of fields) {
        const fKey = normalizeDedupeKey(field);
        if (fKey === qKey) score = Math.max(score, 1);
        else if (fKey.includes(qKey) || qKey.includes(fKey)) score = Math.max(score, 0.85);
        else if (jaccardSimilarity(qTokens, significantTokens(field)) >= 0.5) score = Math.max(score, 0.7);
      }
      return { row, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((entry) => entry.row);
}

export function lookupInventoryByUrl(
  catalog: PostCreatorInventoryCatalog,
  query: string,
  limit = 8,
): PostCreatorInventoryRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qSlug = deriveSlugFromText(q.replace(/^https?:\/\/[^/]+/i, ""));
  return catalog.rows
    .filter((row) => {
      const path = pathnameFromUrl(row.url);
      return (
        row.url.toLowerCase().includes(q) ||
        path.includes(q) ||
        (qSlug && row.slug === qSlug) ||
        (qSlug && path.endsWith(`/${qSlug}`))
      );
    })
    .slice(0, limit);
}

export function lookupInventoryByTitle(
  catalog: PostCreatorInventoryCatalog,
  query: string,
  limit = 8,
): PostCreatorInventoryRow[] {
  return lookupInventoryByKeyword(catalog, query, limit);
}

export type PostCreatorCannibalToolName =
  | "lookup_inventory_by_keyword"
  | "lookup_inventory_by_url"
  | "lookup_inventory_by_title";

export function executePostCreatorCannibalTool(
  catalog: PostCreatorInventoryCatalog,
  toolName: PostCreatorCannibalToolName,
  args: { query?: string },
): PostCreatorInventoryRow[] {
  const query = args.query ?? "";
  if (toolName === "lookup_inventory_by_url") return lookupInventoryByUrl(catalog, query);
  if (toolName === "lookup_inventory_by_title") return lookupInventoryByTitle(catalog, query);
  return lookupInventoryByKeyword(catalog, query);
}

export const POST_CREATOR_CANNIBAL_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "lookup_inventory_by_keyword",
      description: "Search site inventory for existing posts matching a keyword or focus phrase.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Keyword or phrase to search." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "lookup_inventory_by_url",
      description: "Search site inventory for an existing URL or slug path.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Full URL, path, or slug stem." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "lookup_inventory_by_title",
      description: "Search site inventory for title overlap with a proposed post title.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Proposed post title." } },
        required: ["query"],
      },
    },
  },
];
