import type { WordPressSite } from "@/components/integrations/types";
import { fetchBlogCatalog } from "@/lib/redirect-matcher/fetch-blog-catalog";
import { grepLegacyKeywords } from "@/lib/redirect-matcher/grep-legacy-keywords";
import { runRedirectMatcherAgent } from "@/lib/redirect-matcher/redirect-matcher-agent";
import type {
  LegacyUrlRow,
  RedirectMatcherProgress,
  RedirectMatcherRunResult,
} from "@/lib/redirect-matcher/types";

export async function runRedirectMatcher(args: {
  site: WordPressSite;
  legacyRows: LegacyUrlRow[];
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (progress: RedirectMatcherProgress) => void;
}): Promise<{ ok: true; result: RedirectMatcherRunResult } | { ok: false; error: string }> {
  const { site, legacyRows, apiKey, signal, onProgress } = args;

  if (!legacyRows.length) {
    return { ok: false, error: "No legacy URLs to match." };
  }

  onProgress?.({
    phase: "parse",
    completed: legacyRows.length,
    total: legacyRows.length,
    uploadRowCount: legacyRows.length,
    message: `${legacyRows.length} legacy URL(s) ready`,
  });

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  onProgress?.({
    phase: "catalog",
    completed: 0,
    total: 1,
    message: "Loading published blog catalog",
  });

  let catalog: Awaited<ReturnType<typeof fetchBlogCatalog>> = [];
  try {
    catalog = await fetchBlogCatalog(site);
  } catch {
    catalog = [];
  }

  onProgress?.({
    phase: "catalog",
    completed: 1,
    total: 1,
    catalogSize: catalog.length,
    message: `${catalog.length} blog post(s) in catalog`,
  });

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  onProgress?.({
    phase: "grep",
    completed: 0,
    total: legacyRows.length,
    message: "Grepping keywords for legacy URLs",
  });

  let enriched;
  try {
    enriched = await grepLegacyKeywords(site, legacyRows, signal, (completed, total) => {
      onProgress?.({
        phase: "grep",
        completed,
        total,
        message: "Grepping keywords for legacy URLs",
      });
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  onProgress?.({
    phase: "match",
    completed: 0,
    total: enriched.length,
    catalogSize: catalog.length,
    message: "AI matching legacy URLs to blog posts",
  });

  let matchedRows;
  try {
    matchedRows = await runRedirectMatcherAgent({
      legacyRows: enriched,
      catalog,
      apiKey,
      siteId: site.id,
      signal,
      onProgress: (completed, total, detail) => {
        onProgress?.({
          phase: "match",
          completed,
          total,
          catalogSize: catalog.length,
          message: "AI matching legacy URLs to blog posts",
          detail,
        });
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }

  const result: RedirectMatcherRunResult = {
    rows: matchedRows,
    catalogSize: catalog.length,
    stats: {
      total: matchedRows.length,
      matched: matchedRows.length,
    },
  };

  onProgress?.({
    phase: "done",
    completed: matchedRows.length,
    total: matchedRows.length,
    catalogSize: catalog.length,
    message: `${matchedRows.length} redirect(s) matched`,
  });

  return { ok: true, result };
}
