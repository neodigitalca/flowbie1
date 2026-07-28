import { useCallback, useRef, useState } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import { loadApiKey } from "@/lib/api";
import { runUrlOptimizer } from "@/lib/url-optimizer/run-url-optimizer";
import type {
  UrlOptimizerInputRow,
  UrlOptimizerProgress,
  UrlOptimizerRunResult,
} from "@/lib/url-optimizer/types";

export function useUrlOptimizerRun() {
  const [phase, setPhase] = useState<UrlOptimizerProgress["phase"]>("idle");
  const [progress, setProgress] = useState<UrlOptimizerProgress>({
    phase: "idle",
    completed: 0,
    total: 0,
  });
  const [result, setResult] = useState<UrlOptimizerRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const running = phase !== "idle" && phase !== "done" && phase !== "error";

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setProgress({ phase: "idle", completed: 0, total: 0 });
  }, []);

  const run = useCallback(
    async (args: { site: WordPressSite | null; inputRows: UrlOptimizerInputRow[] }) => {
      const { site, inputRows } = args;
      setError(null);
      setResult(null);

      if (!site) {
        setError("Connect a WordPress site first.");
        return { ok: false as const, error: "Connect a WordPress site first." };
      }

      const apiKey = loadApiKey()?.trim();
      if (!apiKey) {
        setError("OpenRouter API key required.");
        return { ok: false as const, error: "OpenRouter API key required." };
      }

      if (!inputRows.length) {
        setError("Upload a GSC Pages CSV first.");
        return { ok: false as const, error: "Upload a GSC Pages CSV first." };
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const signal = ac.signal;

      setPhase("parse");
      setProgress({ phase: "parse", completed: 0, total: inputRows.length });

      const res = await runUrlOptimizer({
        site,
        inputRows,
        apiKey,
        signal,
        onProgress: (p) => {
          setPhase(p.phase);
          setProgress(p);
        },
      });

      abortRef.current = null;

      if (res.ok === false) {
        const errMsg = res.error;
        if (errMsg !== "Cancelled") setError(errMsg);
        setPhase(errMsg === "Cancelled" ? "idle" : "error");
        return { ok: false as const, error: errMsg };
      }

      setResult(res.result);
      setPhase("done");
      return { ok: true as const, result: res.result };
    },
    [],
  );

  return { phase, progress, result, error, running, run, cancel, setResult };
}
