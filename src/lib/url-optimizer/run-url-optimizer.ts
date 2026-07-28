import type { WordPressSite } from "@/components/integrations/types";
import {
  fetchUrlOptimizerContentRows,
  urlBelongsToSite,
} from "@/lib/url-optimizer/fetch-url-optimizer-rows";
import {
  buildUrlOptimizerStats,
  runUrlOptimizerAgent,
} from "@/lib/url-optimizer/url-optimizer-agent";
import type {
  UrlOptimizerInputRow,
  UrlOptimizerProgress,
  UrlOptimizerRunResult,
} from "@/lib/url-optimizer/types";

export async function runUrlOptimizer(args: {
  site: WordPressSite;
  inputRows: UrlOptimizerInputRow[];
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (progress: UrlOptimizerProgress) => void;
}): Promise<{ ok: true; result: UrlOptimizerRunResult } | { ok: false; error: string }> {
  const { site, inputRows, apiKey, signal, onProgress } = args;

  if (!inputRows.length) {
    return { ok: false, error: "No URLs found in CSV." };
  }

  const domainMismatch = inputRows.find((row) => !urlBelongsToSite(row.page, site));
  if (domainMismatch) {
    return {
      ok: false,
      error: `URL domain does not match connected site: ${domainMismatch.page}`,
    };
  }

  onProgress?.({
    phase: "parse",
    completed: inputRows.length,
    total: inputRows.length,
    uploadRowCount: inputRows.length,
    message: `${inputRows.length} URLs in CSV`,
  });

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  onProgress?.({
    phase: "resolve",
    completed: 0,
    total: inputRows.length,
    message: "Matching CSV URLs to WordPress posts",
  });

  let contentRows;
  try {
    contentRows = await fetchUrlOptimizerContentRows({
      site,
      inputRows,
      signal,
      onProgress: (completed, total, phase) => {
        onProgress?.({
          phase: phase === "resolve" ? "resolve" : "fetch",
          completed,
          total,
          message:
            phase === "resolve"
              ? "Matching CSV URLs to WordPress posts"
              : "Loading title, meta, and body excerpt",
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

  if (signal?.aborted) return { ok: false, error: "Cancelled" };

  onProgress?.({
    phase: "optimize",
    completed: 0,
    total: contentRows.filter((r) => r.contentStatus === "resolved").length,
  });

  let resultRows;
  try {
    resultRows = await runUrlOptimizerAgent(contentRows, apiKey, signal, (completed, total, detail) => {
      onProgress?.({
        phase: "optimize",
        completed,
        total,
        message: "OpenRouter slug proposals",
        detail,
      });
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }

  const result: UrlOptimizerRunResult = {
    rows: resultRows,
    stats: buildUrlOptimizerStats(resultRows),
  };

  onProgress?.({ phase: "done", completed: resultRows.length, total: resultRows.length });
  return { ok: true, result };
}
