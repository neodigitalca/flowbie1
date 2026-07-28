import {
  buildLocalGridSummary,
  dominantKeywordFromRows,
  LOCAL_CSV_WORKER_FILE_BYTES_THRESHOLD,
  parseLocalDominatorCsv,
  placeWeaknessWeightsFromRows,
  weaknessScoreFromKeywordStats,
  type LocalDominatorRow,
  type PlaceWeaknessWeight,
} from "@/lib/local-dominator-csv";

export type GridKeywordWeight = {
  keyword: string;
  weight: number;
};

export type { PlaceWeaknessWeight };

export type ProcessLocalCsvResult =
  | {
      ok: true;
      gridSummaryMarkdown: string;
      placeHints: string[];
      gridKeywordWeights: GridKeywordWeight[];
      /** Per City, ST: higher weight = weaker average rank (prioritize entity focus). */
      placeWeaknessWeights: PlaceWeaknessWeight[];
      /** Sampled grid rows for direct SAP (no OpenRouter row model) - same set as grid summary. */
      gridRowsForDirectSap: LocalDominatorRow[];
      dominantKeyword: string;
      wasCapped: boolean;
      originalCount: number;
      loadedRowCount: number;
      parsedRowCount: number;
      matchedRowCount: number;
      addressFilterApplied: boolean;
    }
  | { ok: false; error: string };

export { LOCAL_CSV_WORKER_FILE_BYTES_THRESHOLD };

export async function processParsedLocalDominatorRows(
  rows: LocalDominatorRow[]
): Promise<ProcessLocalCsvResult> {
  const working = rows;

  const summary = buildLocalGridSummary(working, {
    rowsForGeographicScope: working,
  });

  const gridKeywordWeights: GridKeywordWeight[] = summary.byKeyword.map((k) => ({
    keyword: k.keyword,
    weight: weaknessScoreFromKeywordStats(k),
  }));
  const placeWeaknessWeights = placeWeaknessWeightsFromRows(working);

  return {
    ok: true,
    gridSummaryMarkdown: summary.summaryMarkdown,
    placeHints: summary.placeHints,
    gridKeywordWeights,
    placeWeaknessWeights,
    gridRowsForDirectSap: working,
    dominantKeyword: dominantKeywordFromRows(working),
    wasCapped: false,
    originalCount: working.length,
    loadedRowCount: working.length,
    parsedRowCount: working.length,
    matchedRowCount: working.length,
    addressFilterApplied: false,
  };
}

function runWorker(text: string): Promise<ProcessLocalCsvResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("../workers/local-analysis-csv.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<ProcessLocalCsvResult>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (ev) => {
      worker.terminate();
      resolve({ ok: false, error: ev.message || "Worker error" });
    };
    worker.postMessage({ text });
  });
}

export async function processLocalDominatorCsvText(
  text: string,
  useWorker: boolean
): Promise<ProcessLocalCsvResult> {
  const parsed = parseLocalDominatorCsv(text);
  if (parsed.error || parsed.rows.length === 0) {
    return { ok: false, error: parsed.error || "No rows parsed" };
  }
  if (useWorker) {
    return runWorker(text);
  }
  return processParsedLocalDominatorRows(parsed.rows);
}
