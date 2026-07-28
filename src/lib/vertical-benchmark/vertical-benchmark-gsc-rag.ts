import type { GscTop10CsvRow, VerticalBenchmarkContentKind } from "@/lib/vertical-benchmark/vertical-benchmark-types";

/** GSC avg position for prompts: round up to whole number (3.2 → 4), not 3.20 — saves tokens. */
export function normalizeGscPositionForTokens(position: number): number {
  const n = Number(position);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n);
}

export type GscTop10RagPage = {
  rank: number;
  url: string;
  clicks: number;
  impressions: number;
  position: number;
  content_kind: VerticalBenchmarkContentKind;
};

export type GscTop10RagPayload = {
  siteId: string;
  siteName: string;
  siteUrl: string;
  clientTag: string;
  dateRange?: { startDate: string; endDate: string };
  topPages: GscTop10RagPage[];
};

/** In-memory GSC top-10 snapshot for Gemini RAG (not a downloaded file). */
export function buildGscTop10RagPayloadForSite(
  siteId: string,
  siteName: string,
  siteUrl: string,
  clientTag: string,
  rows: GscTop10CsvRow[],
  contentKind: VerticalBenchmarkContentKind = "post",
  dateRange?: { startDate: string; endDate: string },
): GscTop10RagPayload {
  const filtered = rows
    .filter((r) => r.site_id === siteId && r.content_kind === contentKind)
    .sort((a, b) => a.rank - b.rank);
  return {
    siteId,
    siteName,
    siteUrl,
    clientTag,
    dateRange,
    topPages: filtered.map((r) => ({
      rank: r.rank,
      url: r.url,
      clicks: r.clicks,
      impressions: r.impressions,
      position: normalizeGscPositionForTokens(r.position),
      content_kind: r.content_kind,
    })),
  };
}

/** GSC ranks 11+ for pivot fallback when top-10 keyword cannibalizes inventory. */
export function buildGscExtendedRagPagesForSite(
  siteId: string,
  rows: GscTop10CsvRow[],
  contentKind: VerticalBenchmarkContentKind = "post",
): GscTop10RagPage[] {
  return rows
    .filter((r) => r.site_id === siteId && r.content_kind === contentKind && r.rank > 10)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      rank: r.rank,
      url: r.url,
      clicks: r.clicks,
      impressions: r.impressions,
      position: normalizeGscPositionForTokens(r.position),
      content_kind: r.content_kind,
    }));
}

export function formatGscExtendedRagBlock(pages: GscTop10RagPage[]): string {
  if (!pages.length) return "";
  const lines = pages
    .slice(0, 20)
    .map(
      (p, i) =>
        `${i + 1}. gsc_rank=${p.rank} url=${p.url} clicks=${p.clicks} impressions=${p.impressions}`,
    )
    .join("\n");
  return `
=== EXTENDED GSC PAGES (ranks 11–30, pivot sources when top-10 intent cannibalizes inventory) ===
${lines}
=== END EXTENDED GSC ===`;
}

export function formatGscTop10RagBlock(payload: GscTop10RagPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** Total bulk CSV rows = sum of each client's GSC post pages (no fixed per-client quota). */
export function sumGscPostPagesAcrossClients(payloads: GscTop10RagPayload[]): number {
  return payloads.reduce((n, p) => n + p.topPages.length, 0);
}

export function buildGscRagPromptInstructions(
  contentKind: VerticalBenchmarkContentKind = "post",
): string {
  const pageType =
    contentKind === "entity" ?
      "top service-area / location landing page URLs"
    : "top blog post URLs";
  return `
=== GSC TOP 10 — BULK ROW SOURCE (IN MEMORY, NOT A FILE) ===
Each client has a GSC_TOP10_RAG JSON listing their actual ${pageType} from Search Console (up to 10 per client, whatever GSC returned).
- Output exactly ONE bulk CSV row per URL in that client's topPages[] — same order, same count. Do not add extra rows.
- Rows adapt the search-winning page's intent for that client; do not invent topics beyond those URLs.
- source_exemplar_url on each row MUST be the exact GSC url string.
- SITE_INVENTORY_JSON is exclusion-only: no duplicate keywords/titles/paths vs existing published content.
=== END GSC RAG INSTRUCTIONS ===`;
}
