/// <reference lib="webworker" />
import { parseLocalDominatorCsv } from "../lib/local-dominator-csv";
import { processParsedLocalDominatorRows } from "../lib/process-local-dominator-upload";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<{ text: string }>) => {
  void (async () => {
    try {
      const { text } = e.data;
      const parsed = parseLocalDominatorCsv(text);
      if (parsed.error || parsed.rows.length === 0) {
        ctx.postMessage({
          ok: false as const,
          error: parsed.error || "No rows parsed",
        });
        return;
      }
      const result = await processParsedLocalDominatorRows(parsed.rows);
      ctx.postMessage(result);
    } catch (err) {
      ctx.postMessage({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  })();
};
