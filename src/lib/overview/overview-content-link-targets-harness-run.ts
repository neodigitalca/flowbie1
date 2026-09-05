import {
  blogPlayLinkInventoryLabel,
  type LinkTargetsPlan,
} from "@/lib/bulk/bulk-generation-wp-inventory";
import { suggestAnchorFromPageTitle } from "@/lib/content-optimization/first-party-authority-prompt";
import type { ExtraTextInventoryLinkRow } from "@/lib/content-generation/extra-text-inventory-links";
import {
  matchInternalLinkQueriesToCatalog,
  normalizeInternalLinkUrl,
  type InternalLinkCatalogItem,
  type InternalLinkQuery,
} from "@/lib/content-generation/internal-link-intent-match";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";

/** One ranked inventory pick per intent query. */
const LINK_TARGETS_PICKS_PER_QUERY = 1;

export function linkRowsToCatalogItems(rows: ExtraTextInventoryLinkRow[]): InternalLinkCatalogItem[] {
  return rows.map((row) => ({
    title: row.title,
    url: row.link,
    slug: row.slug,
    collection: row.postType === "page" ? "pages" : "posts",
    postType: row.postType,
    excerpt: row.excerpt,
  }));
}

function catalogHasPages(catalog: InternalLinkCatalogItem[]): boolean {
  return catalog.some((item) => blogPlayLinkInventoryLabel(item.collection, item.postType) === "PAGE");
}

function catalogItemByUrl(
  catalog: InternalLinkCatalogItem[],
  url: string,
): InternalLinkCatalogItem | undefined {
  const key = normalizeInternalLinkUrl(url);
  return catalog.find((item) => normalizeInternalLinkUrl(item.url) === key);
}

function queryWordsFromTitle(title: string): string {
  return title
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

function baseQueryId(matchKey: string): string {
  return matchKey.split("~")[0] ?? matchKey;
}

function lookupQuery(matchKey: string, queries: InternalLinkQuery[]): InternalLinkQuery | undefined {
  const base = baseQueryId(matchKey);
  return queries.find((q) => q.id === base);
}

export function buildLinkTargetQueries(args: {
  primaryKeyword: string;
  bodySectionTitles: string[];
}): InternalLinkQuery[] {
  const keyword = args.primaryKeyword.trim();
  const sections = args.bodySectionTitles.map((t) => t.trim()).filter(Boolean);
  const queries: InternalLinkQuery[] = [];

  for (let i = 0; i < sections.length; i++) {
    const sectionTitle = sections[i]!;
    const words = queryWordsFromTitle(sectionTitle);
    queries.push({
      id: `section-${i}-page`,
      query: `${words} product service`.trim(),
      anchor: sectionTitle,
    });
    queries.push({
      id: `section-${i}-blog`,
      query: `${words} guide tips how to`.trim(),
      anchor: sectionTitle,
    });
    queries.push({
      id: `section-${i}-related`,
      query: `${words} options features`.trim(),
      anchor: sectionTitle,
    });
  }

  if (keyword) {
    queries.push({
      id: "global-page",
      query: `${keyword} product service`,
      anchor: keyword,
    });
  }

  return queries;
}

export function buildLinkTargetsPlanFromMatches(args: {
  catalog: InternalLinkCatalogItem[];
  queries: InternalLinkQuery[];
  urlByQueryId: Map<string, string>;
}): LinkTargetsPlan {
  const pageTargets: LinkTargetsPlan["pageTargets"] = [];
  const blogTargets: LinkTargetsPlan["blogTargets"] = [];
  const seenEntry = new Set<string>();

  for (const [matchKey, url] of args.urlByQueryId) {
    if (!url) continue;
    const query = lookupQuery(matchKey, args.queries);
    if (!query) continue;
    const item = catalogItemByUrl(args.catalog, url);
    if (!item) continue;
    const bucket = blogPlayLinkInventoryLabel(item.collection, item.postType);
    const queryText = queryWordsFromTitle(query.query) || item.title.trim();
    const sectionHints =
      query.id.startsWith("section-") && query.anchor.trim() ? [query.anchor.trim()] : [];
    const entry = {
      url: item.url,
      title: item.title.trim() || query.anchor,
      query: queryText,
      sectionHints,
      suggestedAnchor: suggestAnchorFromPageTitle(item.title.trim() || query.anchor),
    };
    const dedupeKey = `${bucket}|${normalizeInternalLinkUrl(item.url)}|${queryText}`;
    if (seenEntry.has(dedupeKey)) continue;
    seenEntry.add(dedupeKey);
    if (bucket === "PAGE") {
      pageTargets.push(entry);
    } else {
      blogTargets.push(entry);
    }
  }

  if (catalogHasPages(args.catalog) && pageTargets.length === 0) {
    throw new Error(
      "Link targets plan: page inventory exists but intent matching returned no page targets.",
    );
  }
  if (!pageTargets.length && !blogTargets.length) {
    throw new Error("Link targets plan: intent matching returned no page or blog targets.");
  }

  return { pageTargets, blogTargets };
}

export function formatLinkTargetsPlanMarkdown(plan: LinkTargetsPlan): string {
  const lines: string[] = ["# Link targets", ""];
  if (plan.pageTargets.length) {
    lines.push("## Pages (product/service/commercial)", "");
    for (const entry of plan.pageTargets) {
      lines.push(`- **${entry.title}**`);
      lines.push(`  - URL: ${entry.url}`);
      lines.push(`  - Query: ${entry.query}`);
      if (entry.sectionHints.length) {
        lines.push(`  - Sections: ${entry.sectionHints.join("; ")}`);
      }
      lines.push("");
    }
  }
  if (plan.blogTargets.length) {
    lines.push("## Blog posts (informational)", "");
    for (const entry of plan.blogTargets) {
      lines.push(`- **${entry.title}**`);
      lines.push(`  - URL: ${entry.url}`);
      lines.push(`  - Query: ${entry.query}`);
      if (entry.sectionHints.length) {
        lines.push(`  - Sections: ${entry.sectionHints.join("; ")}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}

/** Intent match: one page + one blog query per section, one pick each (~2×sections + 1 links). */
export async function runContentLinkTargetsHarness(args: {
  apiKey: string;
  siteId: string;
  primaryKeyword: string;
  bodySectionTitles: string[];
  linkPool: ExtraTextInventoryLinkRow[];
  fileManager: OptimizationFileManager;
  fileSlug: string;
  signal?: AbortSignal;
}): Promise<LinkTargetsPlan> {
  const catalog = linkRowsToCatalogItems(args.linkPool);
  if (!catalog.length) {
    throw new Error("Link targets plan: link catalog is empty.");
  }

  const queries = buildLinkTargetQueries({
    primaryKeyword: args.primaryKeyword,
    bodySectionTitles: args.bodySectionTitles,
  });

  const urlByQueryId = await matchInternalLinkQueriesToCatalog({
    apiKey: args.apiKey,
    siteId: args.siteId,
    catalog,
    queries,
    signal: args.signal,
    picksPerQuery: LINK_TARGETS_PICKS_PER_QUERY,
  });

  const plan = buildLinkTargetsPlanFromMatches({ catalog, queries, urlByQueryId });

  const jsonName = `link-targets-${args.fileSlug}.json`;
  args.fileManager.addFile(jsonName, JSON.stringify(plan, null, 2), "application/json");
  return plan;
}
