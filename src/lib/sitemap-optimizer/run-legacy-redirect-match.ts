import type { WordPressSite } from "@/components/integrations/types";
import {
  createPressReleaseInventoryHostedLink,
  fetchPressReleaseSiteInventory,
  type PressReleaseInventoryHostedLink,
} from "@/lib/press-release/press-release-site-inventory";
import { buildLegacyRedirectRankMathCsv } from "@/lib/sitemap-optimizer/legacy-redirect-export-csv";
import { resolveLegacyRedirectDefaultBlogUrl } from "@/lib/sitemap-optimizer/legacy-redirect-grid-rows";
import { runLegacyRedirectMatchAgent } from "@/lib/sitemap-optimizer/legacy-redirect-match-agent";
import type {
  LegacyRedirectBatchProgress,
  LegacyRedirectMatchProgress,
  LegacyRedirectMatchRow,
  LegacyRedirectMatchRunResult,
} from "@/lib/sitemap-optimizer/types";

export async function runLegacyRedirectMatch(args: {
  site: WordPressSite;
  legacySheetText: string;
  legacySheetName?: string;
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (progress: LegacyRedirectMatchProgress) => void;
  onPartialMatches?: (matches: LegacyRedirectMatchRow[]) => void;
  onMatch?: (match: LegacyRedirectMatchRow) => void;
  onBatchProgress?: (batches: LegacyRedirectBatchProgress[]) => void;
  uploadUrlCount?: number;
}): Promise<
  | {
      ok: true;
      result: LegacyRedirectMatchRunResult;
      hostedLink: PressReleaseInventoryHostedLink;
    }
  | { ok: false; error: string }
> {
  const { site, legacySheetText, legacySheetName, apiKey, signal, onProgress } = args;

  if (!apiKey.trim()) {
    return { ok: false, error: "OpenRouter API key required." };
  }

  if (!legacySheetText.trim()) {
    return { ok: false, error: "Upload or paste a legacy URL sheet first." };
  }

  const sheetLineCount = legacySheetText.split(/\r?\n/).filter((l) => l.trim()).length;
  const urlTotal = args.uploadUrlCount ?? sheetLineCount;

  onProgress?.({
    phase: "inventory",
    completed: 0,
    total: urlTotal,
    message: "Load site inventory",
    uploadRowCount: urlTotal,
    matchedCount: 0,
  });

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  const inventoryResult = await fetchPressReleaseSiteInventory(site);
  if (inventoryResult.error?.trim() && !inventoryResult.rows.length) {
    return { ok: false, error: inventoryResult.error.trim() };
  }
  if (!inventoryResult.inventoryJson?.length || !inventoryResult.rows.length) {
    return { ok: false, error: "Site inventory is empty." };
  }

  const allowedDestinationUrls = [
    ...new Set(
      inventoryResult.rows
        .map((r) => r.url?.trim())
        .filter((u): u is string => Boolean(u)),
    ),
  ];

  if (!allowedDestinationUrls.length) {
    return { ok: false, error: "Site inventory has no destination URLs." };
  }

  const hostedLink = createPressReleaseInventoryHostedLink(
    site.siteUrl,
    inventoryResult.inventoryJson,
  );

  onProgress?.({
    phase: "inventory",
    completed: urlTotal,
    total: urlTotal,
    catalogSize: allowedDestinationUrls.length,
    uploadRowCount: urlTotal,
    matchedCount: urlTotal,
    message: "Load site inventory",
  });

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  onProgress?.({
    phase: "match",
    completed: 0,
    total: urlTotal,
    batchesCompleted: 0,
    batchesTotal: 0,
    catalogSize: allowedDestinationUrls.length,
    uploadRowCount: urlTotal,
    matchedCount: 0,
    message: "Match redirects",
  });

  let matchedRows: LegacyRedirectMatchRow[] = [];
  const blogIndexUrl = resolveLegacyRedirectDefaultBlogUrl(site.siteUrl, allowedDestinationUrls);
  if (!blogIndexUrl) {
    return { ok: false, error: "Could not resolve site /blog/ URL." };
  }
  const siteInventory = {
    site: { url: site.siteUrl.trim() },
    generatedAt: new Date().toISOString(),
    posts: inventoryResult.rows.map(({ collection: _c, ...rest }) => rest),
  };
  try {
    matchedRows = await runLegacyRedirectMatchAgent({
      legacySheetText,
      legacySheetName,
      allowedDestinationUrls,
      blogIndexUrl,
      siteInventory,
      apiKey,
      siteId: site.id,
      signal,
      onProgress: (completedBatches, totalBatches, processedCount) => {
        onProgress?.({
          phase: "match",
          completed: processedCount,
          total: urlTotal,
          batchesCompleted: completedBatches,
          batchesTotal: totalBatches,
          matchedCount: processedCount,
          redirectCount: matchedRows.length,
          catalogSize: allowedDestinationUrls.length,
          uploadRowCount: urlTotal,
          message: "Match redirects",
        });
      },
      onPartialMatches: args.onPartialMatches,
      onMatch: (match) => {
        matchedRows = [...matchedRows, match];
        args.onMatch?.(match);
      },
      onBatchProgress: args.onBatchProgress,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }

  const csv = buildLegacyRedirectRankMathCsv(matchedRows);
  const result: LegacyRedirectMatchRunResult = {
    rows: matchedRows,
    catalogSize: allowedDestinationUrls.length,
    csv,
  };

  onProgress?.({
    phase: "done",
    completed: urlTotal,
    total: urlTotal,
    batchesCompleted: 1,
    batchesTotal: 1,
    matchedCount: urlTotal,
    redirectCount: matchedRows.length,
    catalogSize: allowedDestinationUrls.length,
    uploadRowCount: urlTotal,
    message: "Build Rank Math CSV",
  });

  return { ok: true, result, hostedLink };
}
