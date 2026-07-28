/**
 * DataForSEO on-page parse (with optional JS retry) + OpenRouter enrichment.
 */

import { fetchOnPageContentParsing } from "@/lib/backlink-research/fetch-on-page-content-parsing";
import {
  extractPageTitleFromOnPageDfsResponse,
  extractPlainTextFromOnPageDfsResponse,
} from "@/lib/backlink-research/on-page-dfs-extract-text";
import { enrichBacklinkTileFromPageText } from "@/lib/backlink-research/enrich-backlink-tile-from-page-text";
import type { BacklinkTileEnrichment } from "@/lib/backlink-research/backlink-tile-enriched";

export async function runBacklinkEnrichmentPipeline(args: {
  url: string;
  industry: string;
  serpSummary: string;
  apiKey: string;
  model: string;
  /** Connected site display name (user's site); used in guest-post subject line as "Company". */
  siteName?: string;
  signal?: AbortSignal;
}): Promise<{ ok: true; enrichment: BacklinkTileEnrichment } | { ok: false; error: string }> {
  let raw = await fetchOnPageContentParsing({
    url: args.url,
    enableJavascript: false,
    signal: args.signal,
  });
  let text = extractPlainTextFromOnPageDfsResponse(raw);
  if (!text.trim()) {
    raw = await fetchOnPageContentParsing({
      url: args.url,
      enableJavascript: true,
      signal: args.signal,
    });
    text = extractPlainTextFromOnPageDfsResponse(raw);
  }
  if (!text.trim()) {
    return { ok: false, error: "No extractable text from this URL (blocked or empty)." };
  }

  const pageTitleHint = extractPageTitleFromOnPageDfsResponse(raw);

  const enrichment = await enrichBacklinkTileFromPageText({
    apiKey: args.apiKey,
    model: args.model,
    pageUrl: args.url,
    pageText: text,
    pageTitleHint,
    industry: args.industry,
    serpSummary: args.serpSummary,
    siteName: args.siteName,
    signal: args.signal,
  });

  if (!enrichment) {
    return { ok: false, error: "AI could not build guidelines from this page." };
  }
  const withOrigin =
    enrichment.csv.origin?.trim()
      ? enrichment
      : { ...enrichment, csv: { ...enrichment.csv, origin: args.url } };
  return { ok: true, enrichment: withOrigin };
}
